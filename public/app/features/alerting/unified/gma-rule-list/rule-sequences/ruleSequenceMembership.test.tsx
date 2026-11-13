import { HttpResponse, http } from 'msw';
import { render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { type RuleSequence, generatedAPI } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import server from '@grafana/test-utils/server';
import { configureStore } from 'app/store/configureStore';

import { setupMswServer } from '../../mockApi';
import { RULE_SEQUENCE_SEARCH_URL } from '../../mocks/server/handlers/k8s/ruleSequences.k8s';
import AlertRulesPage from '../alert-rules/AlertRulesPage';
import { ruleItem } from '../mocks/factories';
import { getRuleSequenceSearchHandler, mockFolderParents, mockRuleSearch } from '../mocks/handlers';
import RecordingRulesPage from '../recording-rules/RecordingRulesPage';
import { type RuleKind } from '../shared/ruleKind';

setupMswServer();

function ruleSequence(name: string, interval: string, recordingRules: string[], alertingRules: string[]): RuleSequence {
  return {
    apiVersion: 'rules.alerting.grafana.app/v0alpha1',
    kind: 'RuleSequence',
    metadata: { name },
    spec: {
      trigger: { interval },
      recordingRules: recordingRules.map((uid) => ({ name: uid })),
      alertingRules: alertingRules.map((uid) => ({ name: uid })),
    },
  };
}

function rule(kind: RuleKind, uid: string, interval: string) {
  const item = ruleItem(kind, uid, uid, 'folder-1');
  return { ...item, fields: { ...item.fields, interval } };
}

function renderPage(page: RuleKind) {
  const Page = page === 'alert' ? AlertRulesPage : RecordingRulesPage;
  return render(<Page />, { historyOptions: { initialEntries: ['/?view=list'] } });
}

function findRow(title: string) {
  return screen.findByRole('listitem', { name: title });
}

describe('rule sequence membership on the rule list', () => {
  beforeEach(() => {
    mockFolderParents({ 'folder-1': 'Team Alerts' });
  });

  it("shows each member's own sequence interval, and the rule's interval on a rule in no sequence", async () => {
    mockRuleSearch('alert', () => ({
      items: [rule('alert', 'cpu-high', '10s'), rule('alert', 'disk-full', '30s'), rule('alert', 'mem-high', '1m')],
      metadata: {},
    }));
    server.use(
      getRuleSequenceSearchHandler([
        ruleSequence('cpu', '2m', ['cpu-rate'], ['cpu-high']),
        ruleSequence('memory', '5m', ['mem-rate'], ['mem-high']),
      ])
    );

    renderPage('alert');

    const cpuHigh = await findRow('cpu-high');
    expect(await within(cpuHigh).findByText('Rule sequence · 2m')).toBeInTheDocument();
    expect(within(cpuHigh).queryByRole('img', { name: 'Evaluated every 10s' })).not.toBeInTheDocument();

    expect(within(await findRow('mem-high')).getByText('Rule sequence · 5m')).toBeInTheDocument();

    const diskFull = await findRow('disk-full');
    expect(within(diskFull).getByRole('img', { name: 'Evaluated every 30s' })).toBeInTheDocument();
    expect(within(diskFull).queryByText(/Rule sequence/)).not.toBeInTheDocument();
  });

  it('shows the sequence on a member that arrives with the next page', async () => {
    mockRuleSearch('alert', (_body, call) =>
      call === 1
        ? { items: [rule('alert', 'cpu-high', '10s')], metadata: { continue: 'page-2' } }
        : { items: [rule('alert', 'disk-full', '30s')], metadata: {} }
    );
    server.use(getRuleSequenceSearchHandler([ruleSequence('disk', '2m', ['disk-rate'], ['disk-full'])]));

    renderPage('alert');
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await within(await findRow('disk-full')).findByText('Rule sequence · 2m')).toBeInTheDocument();
    expect(within(await findRow('cpu-high')).getByRole('img', { name: 'Evaluated every 10s' })).toBeInTheDocument();
  });

  it("still shows each row's sequence when the page's sequence search fails", async () => {
    mockRuleSearch('alert', () => ({
      items: [rule('alert', 'cpu-high', '10s'), rule('alert', 'disk-full', '30s')],
      metadata: {},
    }));
    server.use(
      http.post(RULE_SEQUENCE_SEARCH_URL, async ({ request }) => {
        const body = (await request.json()) as { where?: { filter?: { values: string[] } } };
        const uids = body.where?.filter?.values ?? [];
        // Only the page's search asks about more than one rule.
        if (uids.length > 1) {
          return HttpResponse.json({ message: 'boom' }, { status: 500 });
        }
        const cpu = { resource: { name: 'cpu' }, fields: { alertRuleUIDs: ['cpu-high'], interval: '2m' } };
        return HttpResponse.json({ items: uids.includes('cpu-high') ? [cpu] : [] });
      })
    );

    renderPage('alert');

    expect(await within(await findRow('cpu-high')).findByText('Rule sequence · 2m')).toBeInTheDocument();
    expect(
      await within(await findRow('disk-full')).findByRole('img', { name: 'Evaluated every 30s' })
    ).toBeInTheDocument();
  });

  it("drops a sequence the rule has left when the page reloads and the page's sequence search fails", async () => {
    mockRuleSearch('alert', () => ({
      items: [rule('alert', 'cpu-high', '10s'), rule('alert', 'disk-full', '30s')],
      metadata: {},
    }));
    server.use(getRuleSequenceSearchHandler([ruleSequence('cpu', '2m', ['cpu-rate'], ['cpu-high'])]));
    const store = configureStore();
    render(<AlertRulesPage />, { store, historyOptions: { initialEntries: ['/?view=list'] } });
    expect(await within(await findRow('cpu-high')).findByText('Rule sequence · 2m')).toBeInTheDocument();

    // From now on the page's search fails, and the rule's own lookup says it is in no sequence.
    server.use(
      http.post(RULE_SEQUENCE_SEARCH_URL, async ({ request }) => {
        const body = (await request.json()) as { where?: { filter?: { values: string[] } } };
        if ((body.where?.filter?.values.length ?? 0) > 1) {
          return HttpResponse.json({ message: 'boom' }, { status: 500 });
        }
        return HttpResponse.json({ items: [] });
      })
    );
    store.dispatch(generatedAPI.util.invalidateTags(['AlertRule']));

    expect(
      await within(await findRow('cpu-high')).findByRole('img', { name: 'Evaluated every 10s' })
    ).toBeInTheDocument();
    expect(within(await findRow('cpu-high')).queryByText(/Rule sequence/)).not.toBeInTheDocument();
  });

  it('stops showing a sequence when the page reloads and every sequence search fails', async () => {
    mockRuleSearch('alert', () => ({
      items: [rule('alert', 'cpu-high', '10s'), rule('alert', 'disk-full', '30s')],
      metadata: {},
    }));
    server.use(getRuleSequenceSearchHandler([ruleSequence('cpu', '2m', ['cpu-rate'], ['cpu-high'])]));
    const store = configureStore();
    render(<AlertRulesPage />, { store, historyOptions: { initialEntries: ['/?view=list'] } });
    expect(await within(await findRow('cpu-high')).findByText('Rule sequence · 2m')).toBeInTheDocument();

    server.use(http.post(RULE_SEQUENCE_SEARCH_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
    store.dispatch(generatedAPI.util.invalidateTags(['AlertRule']));

    await waitFor(() =>
      expect(
        within(screen.getByRole('listitem', { name: 'cpu-high' })).queryByText(/Rule sequence/)
      ).not.toBeInTheDocument()
    );
    expect(within(await findRow('cpu-high')).getByRole('link', { name: 'cpu-high' })).toBeInTheDocument();
    expect(within(await findRow('cpu-high')).queryByRole('img', { name: /Evaluated every/ })).not.toBeInTheDocument();
  });

  it('marks a recording rule by the recording members of a sequence, not its alert members', async () => {
    mockRuleSearch('recording', () => ({
      items: [rule('recording', 'cpu-rate', '30s'), rule('recording', 'cpu-high', '1m')],
      metadata: {},
    }));
    server.use(getRuleSequenceSearchHandler([ruleSequence('cpu', '2m', ['cpu-rate'], ['cpu-high'])]));

    renderPage('recording');

    expect(await within(await findRow('cpu-rate')).findByText('Rule sequence · 2m')).toBeInTheDocument();

    const cpuHigh = await findRow('cpu-high');
    expect(await within(cpuHigh).findByRole('img', { name: 'Evaluated every 1m' })).toBeInTheDocument();
    expect(within(cpuHigh).queryByText(/Rule sequence/)).not.toBeInTheDocument();
  });
});
