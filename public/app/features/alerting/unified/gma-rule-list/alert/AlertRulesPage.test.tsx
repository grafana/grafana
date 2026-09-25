import { HttpResponse, http } from 'msw';
import { render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { type DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { clearAllEnrichmentCaches } from '../shared/caches';
import { _resetRuleListRefreshForTests } from '../shared/refreshRuleLists';

import AlertRulesPage from './AlertRulesPage';

const server = setupMswServer();

const ALERT_SEARCH_URL = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/:namespace/alertrules/search';
const FOLDER_SEARCH_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/search';
const FOLDER_PARENTS_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name/parents';
const FOLDER_COUNTS_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name/counts';

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
    contextSrv.user.permissions = { [AccessControlAction.AlertingRuleRead]: true };
    mockFolderParents({ 'folder-1': 'Team Alerts', 'folder-2': 'Infra' });
    mockFolderCounts({ 'folder-1': 3, 'folder-2': 0 });
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
    await waitFor(() => expect(screen.getAllByText('3')).not.toHaveLength(0));
    // Collapsed: no rule rows or per-folder rule requests have happened yet.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
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

    const expandButtons = screen.getAllByRole('button', { expanded: false });
    await within(document.body).findByText('Team Alerts');
    await userEvent.click(expandButtons[0]);

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
          return HttpResponse.json({ items: [ruleItem('rule-1', 'CPU high', 'folder-1')], metadata: { continue: 'tok' } });
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
});
