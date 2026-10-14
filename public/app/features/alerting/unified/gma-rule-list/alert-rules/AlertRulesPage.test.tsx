import { HttpResponse, http } from 'msw';
import { render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { type DataSourceSrv, reportInteraction, setDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';

import AlertRulesPage from './AlertRulesPage';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const reportInteractionMock = jest.mocked(reportInteraction);

const server = setupMswServer();

const ALERT_SEARCH_URL = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/:namespace/alertrules/searchRules';
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

  it('does not search and names the filter when the URL asks for the default notification policy', async () => {
    const requests: unknown[] = [];
    mockAlertRuleSearch((body) => {
      requests.push(body);
      return { items: [], metadata: {} };
    });

    render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?search=policy%3Adefault&view=list'] } });

    expect(await screen.findByText('Fix the invalid filter to see results')).toBeInTheDocument();
    expect(screen.getByText(/Some filters could not be applied: policy/)).toBeInTheDocument();
    expect(requests).toEqual([]);
  });

  it('sends the List search to the per-kind searchRules endpoint with the criteria as the request body', async () => {
    let body: unknown;
    mockAlertRuleSearch((received) => {
      body = received;
      return { items: [ruleItem('rule-1', 'CPU high', 'folder-1')], metadata: {} };
    });

    render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?search=paused%3Afalse&view=list'] } });

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    expect(body).toMatchObject({
      kind: 'SearchQuery',
      where: { filter: { field: 'paused', operator: 'In', values: ['false'] } },
    });
  });

  // STATE-1: a failed first page shows an error with Retry instead of the empty state.
  it('retries a failed first List page and then shows its rules', async () => {
    let call = 0;
    server.use(
      http.post(ALERT_SEARCH_URL, () => {
        call += 1;
        return call === 1
          ? HttpResponse.json({ message: 'boom' }, { status: 500 })
          : HttpResponse.json({ items: [ruleItem('rule-1', 'CPU high', 'folder-1')], metadata: {} });
      })
    );

    render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load rules');
    expect(screen.queryByText('No Alert rules found')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    expect(call).toBe(2);
  });

  // STATE-1: a Load more failure keeps the already-loaded rows visible; Retry repeats that request.
  it('keeps loaded rows visible when Load more fails and repeats the same continuation request on Retry', async () => {
    const continuations: Array<string | null> = [];
    let failNext = true;
    server.use(
      http.post(ALERT_SEARCH_URL, async ({ request }) => {
        const { continue: token = null } = (await request.json()) as { continue?: string };
        continuations.push(token);
        if (!token) {
          return HttpResponse.json({
            items: [ruleItem('rule-1', 'CPU high', 'folder-1')],
            metadata: { continue: 'tok' },
          });
        }
        if (failNext) {
          failNext = false;
          return HttpResponse.json({ message: 'boom' }, { status: 500 });
        }
        return HttpResponse.json({ items: [ruleItem('rule-2', 'Disk full', 'folder-2')], metadata: {} });
      })
    );

    render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Failed to load more results')).toBeInTheDocument();
    expect(screen.getByText('CPU high')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Disk full')).toBeInTheDocument();
    expect(screen.getByText('CPU high')).toBeInTheDocument();
    expect(continuations).toEqual([null, 'tok', 'tok']);
  });

  // STATE-1: a rejected continuation token can never succeed, so Retry starts the chain again.
  it('restarts from the first page when Retry follows a rejected continuation token', async () => {
    const continuations: Array<string | null> = [];
    server.use(
      http.post(ALERT_SEARCH_URL, async ({ request }) => {
        const { continue: token = null } = (await request.json()) as { continue?: string };
        continuations.push(token);
        if (token === 'stale-token') {
          return HttpResponse.json({ message: 'token expired' }, { status: 410 });
        }
        return HttpResponse.json({
          items: [ruleItem('rule-1', 'CPU high', 'folder-1')],
          metadata: { continue: 'stale-token' },
        });
      })
    );

    render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    await screen.findByText('CPU high');
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await screen.findByText('Failed to load more results');

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('button', { name: 'Load more' })).toBeInTheDocument();
    expect(continuations).toEqual([null, 'stale-token', null]);
    expect(screen.getAllByText('CPU high')).toHaveLength(1);
  });

  // STATE-4
  it('loads one page once when Load more is double clicked', async () => {
    const continuations: Array<string | null> = [];
    let releasePage: () => void = () => {};
    const pageGate = new Promise<void>((resolve) => {
      releasePage = resolve;
    });
    server.use(
      http.post(ALERT_SEARCH_URL, async ({ request }) => {
        const { continue: token = null } = (await request.json()) as { continue?: string };
        continuations.push(token);
        if (!token) {
          return HttpResponse.json({
            items: [ruleItem('rule-1', 'CPU high', 'folder-1')],
            metadata: { continue: 'tok' },
          });
        }
        await pageGate;
        return HttpResponse.json({ items: [ruleItem('rule-2', 'Disk full', 'folder-2')], metadata: {} });
      })
    );

    render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    await screen.findByText('CPU high');
    await userEvent.dblClick(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load more' })).toBeDisabled());
    releasePage();

    expect(await screen.findByText('Disk full')).toBeInTheDocument();
    expect(continuations).toEqual([null, 'tok']);
  });

  // STATE-1: a failed expanded folder shows its own error and keeps the folder row.
  it('shows a retryable error inside an expanded folder whose rule search failed', async () => {
    mockFolderSearch(() => ({ items: [folderItem('folder-1', 'Team Alerts')], metadata: {} }));
    let call = 0;
    server.use(
      http.post(ALERT_SEARCH_URL, () => {
        call += 1;
        return call === 1
          ? HttpResponse.json({ message: 'boom' }, { status: 500 })
          : HttpResponse.json({ items: [ruleItem('rule-1', 'CPU high', 'folder-1')], metadata: {} });
      })
    );

    render(<AlertRulesPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Expand Team Alerts', expanded: false }));

    expect(await screen.findByText('Failed to load rules')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(screen.queryByText('No Alert rules in this folder')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
  });

  it('loads more rules inside an expanded folder without touching other folders', async () => {
    mockFolderSearch(() => ({
      items: [folderItem('folder-1', 'Team Alerts'), folderItem('folder-2', 'Infra')],
      metadata: {},
    }));
    const requested: Array<{ folders?: string[]; token: string | null }> = [];
    server.use(
      http.post(ALERT_SEARCH_URL, async ({ request }) => {
        const body = (await request.json()) as { where?: { filter?: { values: string[] } }; continue?: string };
        requested.push({ folders: body.where?.filter?.values, token: body.continue ?? null });
        return body.continue
          ? HttpResponse.json({ items: [ruleItem('rule-2', 'Disk full', 'folder-1')], metadata: {} })
          : HttpResponse.json({
              items: [ruleItem('rule-1', 'CPU high', 'folder-1')],
              metadata: { continue: 'tok' },
            });
      })
    );

    render(<AlertRulesPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Expand Team Alerts', expanded: false }));
    await screen.findByText('CPU high');
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Disk full')).toBeInTheDocument();
    expect(requested).toEqual([
      { folders: ['folder-1'], token: null },
      { folders: ['folder-1'], token: 'tok' },
    ]);
  });

  // STATE-1: Folders mode paging.
  it('pages through folders with Next and Previous, requesting each page once', async () => {
    const tokens: Array<string | null> = [];
    server.use(
      http.post(FOLDER_SEARCH_URL, async ({ request }) => {
        const { continue: token = null } = (await request.json()) as { continue?: string };
        tokens.push(token);
        return token
          ? HttpResponse.json({ items: [folderItem('folder-2', 'Infra')], metadata: {} })
          : HttpResponse.json({ items: [folderItem('folder-1', 'Team Alerts')], metadata: { continue: 'page-2' } });
      })
    );

    render(<AlertRulesPage />);

    expect(await screen.findByText('Team Alerts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Infra')).toBeInTheDocument();
    expect(screen.queryByText('Team Alerts')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(await screen.findByText('Team Alerts')).toBeInTheDocument();
    expect(screen.queryByText('Infra')).not.toBeInTheDocument();
    expect(tokens).toEqual([null, 'page-2']);
  });

  it('keeps the current folder page and offers Retry when the next folder page fails', async () => {
    let failNext = true;
    server.use(
      http.post(FOLDER_SEARCH_URL, async ({ request }) => {
        const { continue: token } = (await request.json()) as { continue?: string };
        if (!token) {
          return HttpResponse.json({
            items: [folderItem('folder-1', 'Team Alerts')],
            metadata: { continue: 'page-2' },
          });
        }
        if (failNext) {
          failNext = false;
          return HttpResponse.json({ message: 'boom' }, { status: 500 });
        }
        return HttpResponse.json({ items: [folderItem('folder-2', 'Infra')], metadata: {} });
      })
    );

    render(<AlertRulesPage />);
    await screen.findByText('Team Alerts');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Failed to load more results')).toBeInTheDocument();
    expect(screen.getByText('Team Alerts')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Infra')).toBeInTheDocument();
  });

  it('shows a retryable error instead of the empty state when the first folder page fails', async () => {
    let call = 0;
    server.use(
      http.post(FOLDER_SEARCH_URL, () => {
        call += 1;
        return call === 1
          ? HttpResponse.json({ message: 'boom' }, { status: 500 })
          : HttpResponse.json({ items: [folderItem('folder-1', 'Team Alerts')], metadata: {} });
      })
    );

    render(<AlertRulesPage />);

    expect(await screen.findByText('Failed to load folders')).toBeInTheDocument();
    expect(screen.queryByText('No folders found')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Team Alerts')).toBeInTheDocument();
  });

  // STATE-3: one mutation refreshes the search, the full rule and the folder counts through tags.
  it('refreshes the folder count, the rule search and the rule itself after a rule is paused', async () => {
    mockFolderSearch(() => ({ items: [folderItem('folder-1', 'Team Alerts')], metadata: {} }));
    let paused = false;
    let countRequests = 0;
    let searchRequests = 0;
    server.use(
      http.get(FOLDER_COUNTS_URL, () => {
        countRequests += 1;
        return HttpResponse.json({
          counts: [{ resource: 'alertrules', group: 'rules.alerting.grafana.app', count: paused ? 2 : 3 }],
        });
      }),
      http.post(ALERT_SEARCH_URL, () => {
        searchRequests += 1;
        return HttpResponse.json({ items: [ruleItem('rule-1', 'CPU high', 'folder-1')], metadata: {} });
      }),
      http.get(ALERT_RULE_GET_URL, ({ params }) =>
        HttpResponse.json({
          apiVersion: 'v0alpha1',
          kind: 'AlertRule',
          metadata: { name: params.name, annotations: { 'grafana.com/access/canWrite': 'true' } },
          spec: { title: 'CPU high', paused },
        })
      ),
      http.patch(ALERT_RULE_GET_URL, () => {
        paused = true;
        return HttpResponse.json({});
      })
    );

    render(<AlertRulesPage />);
    expect(await screen.findByText('3 alert rules')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Team Alerts', expanded: false }));
    await screen.findByText('CPU high');

    const ruleRow = await screen.findByRole('listitem', { name: 'CPU high' });
    await userEvent.click(await within(ruleRow).findByRole('button', { name: /more/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Pause' }));

    expect(await screen.findByText('2 alert rules')).toBeInTheDocument();
    await waitFor(() => expect(searchRequests).toBe(2));
    expect(countRequests).toBe(2);
    await userEvent.click(await within(ruleRow).findByRole('button', { name: /more/i }));
    expect(await screen.findByRole('menuitem', { name: 'Resume' })).toBeInTheDocument();
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
