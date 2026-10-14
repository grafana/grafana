import { HttpResponse, http } from 'msw';
import { render, screen, userEvent, waitFor } from 'test/test-utils';

import { type DataSourceSrv, reportInteraction, setDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { _resetRuleListRefreshForTests } from '../rule-data/refreshRuleLists';
import { clearAllEnrichmentCaches } from '../rule-data/ruleResourceLookups';

import RecordingRulesPage from './RecordingRulesPage';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const reportInteractionMock = jest.mocked(reportInteraction);

const server = setupMswServer();

const RECORDING_SEARCH_URL = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/:namespace/recordingrules/search';
const FOLDER_SEARCH_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/search';
const FOLDER_PARENTS_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name/parents';
const FOLDER_COUNTS_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name/counts';
const RECORDING_RULE_GET_URL = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/:namespace/recordingrules/:name';

setDataSourceSrv({
  getList: () => [],
  getInstanceSettings: () => undefined,
} as unknown as DataSourceSrv);

function folderItem(uid: string, title: string) {
  return {
    resource: { group: 'folder.grafana.app', kind: 'Folder', name: uid, resource: 'folders' },
    fields: { title },
  };
}

function ruleItem(uid: string, title: string, folder: string) {
  return {
    resource: { group: 'rules.alerting.grafana.app', kind: 'RecordingRule', name: uid, resource: 'recordingrules' },
    fields: { title, folder },
  };
}

function mockFolderSearch(handler: () => object) {
  server.use(http.post(FOLDER_SEARCH_URL, () => HttpResponse.json(handler())));
}

function mockRecordingRuleSearch(fn: (body: unknown) => object) {
  server.use(
    http.post(RECORDING_SEARCH_URL, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json(fn(body));
    })
  );
}

function mockFolderParents(titleByUid: Record<string, string>) {
  server.use(
    http.get(FOLDER_PARENTS_URL, ({ params }) => {
      const name = params.name as string;
      return HttpResponse.json({ items: [{ name, title: titleByUid[name] ?? name }] });
    })
  );
}

function mockFolderCounts(countByUid: Record<string, number>) {
  server.use(
    http.get(FOLDER_COUNTS_URL, ({ params }) => {
      const name = params.name as string;
      return HttpResponse.json({
        counts: [{ resource: 'recordingrules', group: 'rules.alerting.grafana.app', count: countByUid[name] ?? 0 }],
      });
    })
  );
}

describe('RecordingRulesPage', () => {
  const previousPermissions = contextSrv.user.permissions;

  beforeEach(() => {
    clearAllEnrichmentCaches();
    _resetRuleListRefreshForTests();
    reportInteractionMock.mockClear();
    contextSrv.user.permissions = { [AccessControlAction.AlertingRuleRead]: true };
    mockFolderParents({ 'folder-1': 'Team Alerts', 'folder-2': 'Infra' });
    mockFolderCounts({ 'folder-1': 3, 'folder-2': 0 });
    server.use(
      http.get(RECORDING_RULE_GET_URL, ({ params }) =>
        HttpResponse.json({
          apiVersion: 'v0alpha1',
          kind: 'RecordingRule',
          metadata: { name: params.name },
          spec: { title: 'rule', paused: false, metric: 'm', trigger: {} },
        })
      )
    );
  });

  afterEach(() => {
    contextSrv.user.permissions = previousPermissions;
  });

  it('shows New recording rule for a user with alert.rules:create', async () => {
    mockFolderSearch(() => ({ items: [], metadata: {} }));
    contextSrv.user.permissions = {
      [AccessControlAction.AlertingRuleRead]: true,
      [AccessControlAction.AlertingRuleCreate]: true,
    };

    render(<RecordingRulesPage />);

    expect(screen.getByRole('link', { name: 'New recording rule' })).toHaveAttribute(
      'href',
      expect.stringContaining('/alerting/new/grafana-recording')
    );
    // Settle the saved-searches async load before the test ends, so its state update lands
    // inside this test's act() scope rather than leaking into the next one.
    await screen.findByRole('button', { name: 'Saved searches' });
  });

  it('hides New recording rule for a user without alert.rules:create', async () => {
    mockFolderSearch(() => ({ items: [], metadata: {} }));

    render(<RecordingRulesPage />);

    expect(screen.queryByRole('link', { name: 'New recording rule' })).not.toBeInTheDocument();
    await screen.findByRole('button', { name: 'Saved searches' });
  });

  // REC-1
  it('Folders mode starts with collapsed, title-sorted folders showing their direct Recording-rule count', async () => {
    mockFolderSearch(() => ({
      items: [folderItem('folder-1', 'Team Alerts'), folderItem('folder-2', 'Infra')],
      metadata: {},
    }));

    render(<RecordingRulesPage />);

    expect(await screen.findByText('Team Alerts')).toBeInTheDocument();
    expect(screen.getByText('Infra')).toBeInTheDocument();
    expect(await screen.findByText('3 recording rules')).toBeInTheDocument();
  });

  // REC-2
  it('expanding a folder loads only that folder Recording rules, filtered by folder UID', async () => {
    mockFolderSearch(() => ({ items: [folderItem('folder-1', 'Team Alerts')], metadata: {} }));

    let lastFolderFilter: string[] | undefined;
    mockRecordingRuleSearch((body) => {
      const searchBody = body as { where?: { filter?: { values: string[] } } };
      lastFolderFilter = searchBody.where?.filter?.values;
      return { items: [ruleItem('rule-1', 'cpu_usage:avg', 'folder-1')], metadata: {} };
    });

    render(<RecordingRulesPage />);
    await screen.findByText('Team Alerts');

    await userEvent.click(screen.getByRole('button', { name: 'Expand Team Alerts', expanded: false }));

    expect(await screen.findByText('cpu_usage:avg')).toBeInTheDocument();
    expect(lastFolderFilter).toEqual(['folder-1']);
  });

  // REC-3
  it('List mode shows title-sorted Recording rules with the full folder path and issues no folder-count requests', async () => {
    let countRequests = 0;
    server.use(
      http.get(FOLDER_COUNTS_URL, () => {
        countRequests += 1;
        return HttpResponse.json({ counts: [] });
      })
    );
    mockRecordingRuleSearch(() => ({
      items: [ruleItem('rule-1', 'cpu_usage:avg', 'folder-1'), ruleItem('rule-2', 'mem_usage:avg', 'folder-2')],
      metadata: {},
    }));

    render(<RecordingRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    expect(await screen.findByText('cpu_usage:avg')).toBeInTheDocument();
    expect(screen.getByText('mem_usage:avg')).toBeInTheDocument();
    await screen.findByText('Team Alerts');
    await screen.findByText('Infra');
    expect(countRequests).toBe(0);
  });

  // M1: one page-view event per mount, with kind and mode, no filter values.
  it('emits grafana_alerting_gma_rule_list_view once on mount with the kind and mode', async () => {
    mockFolderSearch(() => ({ items: [], metadata: {} }));
    mockRecordingRuleSearch(() => ({ items: [], metadata: {} }));

    render(<RecordingRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    await screen.findByText('No Recording rules found');

    const pageViewCalls = reportInteractionMock.mock.calls.filter(
      ([event]) => event === 'grafana_alerting_gma_rule_list_view'
    );
    expect(pageViewCalls).toEqual([['grafana_alerting_gma_rule_list_view', { kind: 'recording', mode: 'list' }]]);
  });

  // Saved searches: the control stays disabled until the one-time legacy copy settles.
  it('shows a disabled Saved searches control until the legacy copy settles, then an interactive one', async () => {
    mockFolderSearch(() => ({ items: [], metadata: {} }));

    render(<RecordingRulesPage />);

    expect(screen.getByRole('button', { name: 'Saved searches' })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Saved searches' })).toBeEnabled());
  });
});
