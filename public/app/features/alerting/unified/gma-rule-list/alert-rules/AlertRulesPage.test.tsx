import { HttpResponse, http } from 'msw';
import { render, screen, userEvent, waitFor } from 'test/test-utils';

import { type DataSourceSrv, reportInteraction, setDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { _resetRuleListRefreshForTests } from '../rule-data/refreshRuleLists';
import { clearAllEnrichmentCaches } from '../rule-data/ruleResourceLookups';

import AlertRulesPage from './AlertRulesPage';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const reportInteractionMock = jest.mocked(reportInteraction);

const server = setupMswServer();

const ALERT_SEARCH_URL = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/:namespace/alertrules/search';
const FOLDER_SEARCH_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/search';
const FOLDER_PARENTS_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name/parents';
const FOLDER_COUNTS_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name/counts';
const ALERT_RULE_GET_URL = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/:namespace/alertrules/:name';

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
    resource: { group: 'rules.alerting.grafana.app', kind: 'AlertRule', name: uid, resource: 'alertrules' },
    fields: { title, folder },
  };
}

function mockFolderSearch(handler: (requestCount: number) => object) {
  let count = 0;
  server.use(
    http.post(FOLDER_SEARCH_URL, () => {
      count += 1;
      return HttpResponse.json(handler(count));
    })
  );
}

function mockAlertRuleSearch(fn: (body: unknown, requestCount: number) => object) {
  let count = 0;
  server.use(
    http.post(ALERT_SEARCH_URL, async ({ request }) => {
      count += 1;
      const body = await request.json();
      return HttpResponse.json(fn(body, count));
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
        counts: [{ resource: 'alertrules', group: 'rules.alerting.grafana.app', count: countByUid[name] ?? 0 }],
      });
    })
  );
}

describe('AlertRulesPage', () => {
  const previousPermissions = contextSrv.user.permissions;

  beforeEach(() => {
    clearAllEnrichmentCaches();
    _resetRuleListRefreshForTests();
    reportInteractionMock.mockClear();
    contextSrv.user.permissions = { [AccessControlAction.AlertingRuleRead]: true };
    mockFolderParents({ 'folder-1': 'Team Alerts', 'folder-2': 'Infra' });
    mockFolderCounts({ 'folder-1': 3, 'folder-2': 0 });
    // Every visible row's action menu loads the full rule for provenance/abilities - a row
    // component detail these page-level tests don't otherwise care about.
    server.use(
      http.get(ALERT_RULE_GET_URL, ({ params }) =>
        HttpResponse.json({
          apiVersion: 'v0alpha1',
          kind: 'AlertRule',
          metadata: { name: params.name },
          spec: { title: 'rule', paused: false },
        })
      )
    );
  });

  afterEach(() => {
    contextSrv.user.permissions = previousPermissions;
  });

  // ALERT-1
  it('Folders mode starts with collapsed, title-sorted folders showing their direct Alert-rule count', async () => {
    mockFolderSearch(() => ({
      items: [folderItem('folder-1', 'Team Alerts'), folderItem('folder-2', 'Infra')],
      metadata: {},
    }));

    render(<AlertRulesPage />);

    expect(await screen.findByText('Team Alerts')).toBeInTheDocument();
    expect(screen.getByText('Infra')).toBeInTheDocument();
    expect(await screen.findByText('3 alert rules')).toBeInTheDocument();
    // Collapsed: no rule rows or per-folder rule requests have happened yet.
    expect(screen.getByRole('link', { name: 'Team Alerts' })).toHaveAttribute(
      'href',
      '/dashboards/f/folder-1/team-alerts/alerting'
    );
    expect(screen.queryByText('CPU high')).not.toBeInTheDocument();
  });

  // SEARCH-7: the folder filter is the one filter Folders mode supports, and it scopes the
  // folder listing itself (not just what's shown once a folder is expanded).
  it('a folder criterion in Folders mode scopes the folder listing to just that folder', async () => {
    let lastWhere: unknown;
    server.use(
      http.post(FOLDER_SEARCH_URL, async ({ request }) => {
        const body = (await request.json()) as { where?: unknown };
        lastWhere = body.where;
        return HttpResponse.json({ items: [folderItem('folder-1', 'Team Alerts')], metadata: {} });
      })
    );

    render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?search=namespace%3Afolder-1'] } });

    expect(await screen.findByText('Team Alerts')).toBeInTheDocument();
    expect(lastWhere).toEqual({ filter: { field: 'name', operator: 'In', values: ['folder-1'] } });
  });

  // ALERT-2
  it('expanding a folder loads only that folder Alert rules; collapsed folders issue no rule request', async () => {
    mockFolderSearch(() => ({
      items: [folderItem('folder-1', 'Team Alerts'), folderItem('folder-2', 'Infra')],
      metadata: {},
    }));

    let ruleSearchCalls = 0;
    let lastFolderFilter: string[] | undefined;
    mockAlertRuleSearch((body) => {
      ruleSearchCalls += 1;
      const searchBody = body as { where?: { filter?: { values: string[] } } };
      lastFolderFilter = searchBody.where?.filter?.values;
      return { items: [ruleItem('rule-1', 'CPU high', 'folder-1')], metadata: {} };
    });

    render(<AlertRulesPage />);
    await screen.findByText('Team Alerts');

    expect(ruleSearchCalls).toBe(0);

    await userEvent.click(screen.getByRole('button', { name: 'Expand Team Alerts', expanded: false }));

    await screen.findByText('CPU high');
    expect(ruleSearchCalls).toBe(1);
    expect(lastFolderFilter).toEqual(['folder-1']);
  });

  // ALERT-3
  it('List mode shows title-sorted Alert rules with the full folder path and issues no folder-count requests', async () => {
    let countRequests = 0;
    server.use(
      http.get(FOLDER_COUNTS_URL, () => {
        countRequests += 1;
        return HttpResponse.json({ counts: [] });
      })
    );
    mockAlertRuleSearch(() => ({
      items: [ruleItem('rule-1', 'CPU high', 'folder-1'), ruleItem('rule-2', 'Disk full', 'folder-2')],
      metadata: {},
    }));

    render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    expect(screen.getByText('Disk full')).toBeInTheDocument();
    await screen.findByText('Team Alerts');
    await screen.findByText('Infra');
    expect(countRequests).toBe(0);
  });

  // STATE-1: initial loading, successful empty response, initial failure.
  it('shows an empty state for a successful empty List response', async () => {
    mockAlertRuleSearch(() => ({ items: [], metadata: {} }));

    render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    expect(await screen.findByText('No Alert rules found')).toBeInTheDocument();
  });

  it('shows a distinct error state when the initial List request fails', async () => {
    server.use(http.post(ALERT_SEARCH_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

    render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load rules');
  });

  // STATE-3: a Load-more failure keeps the already-loaded rows visible and offers retry.
  it('keeps loaded rows visible and offers retry when Load more fails', async () => {
    let call = 0;
    server.use(
      http.post(ALERT_SEARCH_URL, () => {
        call += 1;
        if (call === 1) {
          return HttpResponse.json({
            items: [ruleItem('rule-1', 'CPU high', 'folder-1')],
            metadata: { continue: 'tok' },
          });
        }
        return HttpResponse.json({ message: 'boom' }, { status: 500 });
      })
    );

    render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Failed to load more rules')).toBeInTheDocument();
    expect(screen.getByText('CPU high')).toBeInTheDocument();
  });

  // M1: one page-view event per mount, with kind and mode, no filter values.
  it('emits grafana_alerting_gma_rule_list_view once on mount with the kind and mode', async () => {
    mockFolderSearch(() => ({ items: [], metadata: {} }));
    mockAlertRuleSearch(() => ({ items: [], metadata: {} }));

    render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    await screen.findByText('No Alert rules found');

    const pageViewCalls = reportInteractionMock.mock.calls.filter(
      ([event]) => event === 'grafana_alerting_gma_rule_list_view'
    );
    expect(pageViewCalls).toEqual([['grafana_alerting_gma_rule_list_view', { kind: 'alert', mode: 'list' }]]);
  });

  it('does not emit another page-view event on a later re-render of the same mount', async () => {
    mockFolderSearch(() => ({ items: [], metadata: {} }));

    const { rerender } = render(<AlertRulesPage />);
    await screen.findByText('No folders found');

    // Re-rendering without unmounting must not re-fire the once-per-mount tracking guard.
    rerender(<AlertRulesPage />);
    await screen.findByText('No folders found');

    const pageViewCalls = reportInteractionMock.mock.calls.filter(
      ([event]) => event === 'grafana_alerting_gma_rule_list_view'
    );
    expect(pageViewCalls).toHaveLength(1);
  });

  // Saved searches: the control stays disabled until the one-time legacy copy settles, then
  // becomes interactive - never reads the page's own collection before that copy finishes.
  it('shows a disabled Saved searches control until the legacy copy settles, then an interactive one', async () => {
    mockFolderSearch(() => ({ items: [], metadata: {} }));

    render(<AlertRulesPage />);

    expect(screen.getByRole('button', { name: 'Saved searches' })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Saved searches' })).toBeEnabled());
  });
});
