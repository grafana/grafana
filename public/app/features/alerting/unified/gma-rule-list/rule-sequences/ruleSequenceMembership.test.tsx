import { HttpResponse, http } from 'msw';
import { render, screen, userEvent } from 'test/test-utils';

import { type RuleSequence } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import server from '@grafana/test-utils/server';

import { setupMswServer } from '../../mockApi';
import { RULE_SEQUENCE_SEARCH_URL } from '../../mocks/server/handlers/k8s/ruleSequences.k8s';
import AlertRulesPage from '../alert-rules/AlertRulesPage';
import { ruleItem } from '../mocks/factories';
import { getRuleSequenceSearchHandler, mockFolderParents, mockRuleSearch } from '../mocks/handlers';
import RecordingRulesPage from '../recording-rules/RecordingRulesPage';

setupMswServer();

interface SequenceSearchBody {
  where?: { filter?: { field: string; values: string[] } };
}

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

function mockSequences(...sequences: RuleSequence[]) {
  const searches: SequenceSearchBody[] = [];
  server.use(getRuleSequenceSearchHandler(sequences, (body) => searches.push(body)));
  return searches;
}

function renderPage(page: 'alert' | 'recording') {
  const Page = page === 'alert' ? AlertRulesPage : RecordingRulesPage;
  return render(<Page />, { historyOptions: { initialEntries: ['/?view=list'] } });
}

describe('rule sequence membership on the rule list', () => {
  beforeEach(() => {
    mockFolderParents({ 'folder-1': 'Team Alerts' });
  });

  it('looks up the whole page in one sequence search and shows the sequence pill on members', async () => {
    mockRuleSearch('alert', () => ({
      items: [
        {
          ...ruleItem('alert', 'rule-1', 'CPU high', 'folder-1'),
          fields: { title: 'CPU high', folder: 'folder-1', interval: '10s' },
        },
        {
          ...ruleItem('alert', 'rule-2', 'Disk full', 'folder-1'),
          fields: { title: 'Disk full', folder: 'folder-1', interval: '30s' },
        },
      ],
      metadata: {},
    }));
    const searches = mockSequences(ruleSequence('seq-1', '2m', ['rec-1'], ['rule-1']));

    renderPage('alert');

    expect(await screen.findByText('Rule sequence · 2m')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Evaluated every 30s' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Evaluated every 10s' })).not.toBeInTheDocument();
    expect(searches).toEqual([
      expect.objectContaining({
        where: { filter: { field: 'alertRuleUIDs', operator: 'In', values: ['rule-1', 'rule-2'] } },
      }),
    ]);
  });

  it('looks up only the new rules when the next page loads', async () => {
    mockRuleSearch('alert', (_body, call) =>
      call === 1
        ? { items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')], metadata: { continue: 'page-2' } }
        : { items: [ruleItem('alert', 'rule-2', 'Disk full', 'folder-1')], metadata: {} }
    );
    const searches = mockSequences(ruleSequence('seq-1', '2m', ['rec-1'], ['rule-2']));

    renderPage('alert');
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByText(/^Rule sequence/)).toBeInTheDocument();
    expect(searches.map((body) => body.where?.filter?.values)).toEqual([['rule-1'], ['rule-2']]);
  });

  it('still shows the page when the sequence search fails, and the rows look up their membership themselves', async () => {
    mockRuleSearch('alert', () => ({
      items: [
        ruleItem('alert', 'rule-1', 'CPU high', 'folder-1'),
        ruleItem('alert', 'rule-2', 'Disk full', 'folder-1'),
      ],
      metadata: {},
    }));
    const searches: SequenceSearchBody[] = [];
    server.use(
      http.post(RULE_SEQUENCE_SEARCH_URL, async ({ request }) => {
        const body = (await request.json()) as SequenceSearchBody;
        searches.push(body);
        if (searches.length === 1) {
          return HttpResponse.json({ message: 'boom' }, { status: 500 });
        }
        const isMember = body.where?.filter?.values.includes('rule-1');
        return HttpResponse.json({
          items: isMember
            ? [{ resource: { name: 'seq-1' }, fields: { alertRuleUIDs: ['rule-1'], recordingRuleUIDs: ['rec-1'] } }]
            : [],
        });
      })
    );

    renderPage('alert');

    expect(await screen.findByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(await screen.findByText(/^Rule sequence/)).toBeInTheDocument();
    expect(searches.slice(1).map((body) => body.where?.filter?.values)).toEqual(
      expect.arrayContaining([['rule-1'], ['rule-2']])
    );
    expect(searches).toHaveLength(3);
  });

  it('looks up recording rules by their own member field', async () => {
    mockRuleSearch('recording', () => ({
      items: [ruleItem('recording', 'rec-1', 'cpu:rate5m', 'folder-1')],
      metadata: {},
    }));
    const searches = mockSequences(ruleSequence('seq-1', '2m', ['rec-1'], ['rule-1']));

    renderPage('recording');

    expect(await screen.findByText(/^Rule sequence/)).toBeInTheDocument();
    expect(searches.map((body) => body.where?.filter)).toEqual([
      { field: 'recordingRuleUIDs', operator: 'In', values: ['rec-1'] },
    ]);
  });
});
