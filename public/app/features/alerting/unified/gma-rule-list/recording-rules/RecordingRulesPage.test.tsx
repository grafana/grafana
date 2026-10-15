import { HttpResponse, http } from 'msw';
import { act, render, screen, userEvent, waitFor } from 'test/test-utils';

import { type DataSourceSrv, locationService, reportInteraction, setDataSourceSrv } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';
import { mockComboboxRect } from '@grafana/test-utils';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';

import RecordingRulesPage from './RecordingRulesPage';

// test-utils swaps locationService per render; a plain spread would freeze the first one.
jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return Object.defineProperty({ ...actual, reportInteraction: jest.fn() }, 'locationService', {
    enumerable: true,
    get: () => actual.locationService,
  });
});

// jsdom reports zero size, so Combobox renders no option rows.
mockComboboxRect();

const reportInteractionMock = jest.mocked(reportInteraction);

const server = setupMswServer();

const RECORDING_SEARCH_URL =
  '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/:namespace/recordingrules/searchRules';
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

function failFirstCall(url: string, ok: object) {
  let calls = 0;
  server.use(
    http.post(url, () => {
      calls += 1;
      return calls === 1 ? HttpResponse.json({ message: 'boom' }, { status: 500 }) : HttpResponse.json(ok);
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
    // Settle the saved-searches load so its state update stays inside this test's act().
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

  // STATE-1
  it('retries a failed first List page and then shows its rules', async () => {
    failFirstCall(RECORDING_SEARCH_URL, { items: [ruleItem('rule-1', 'cpu_usage:avg', 'folder-1')], metadata: {} });

    render(<RecordingRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load rules');
    expect(screen.queryByText('No Recording rules found')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('cpu_usage:avg')).toBeInTheDocument();
  });

  // STATE-1 and STATE-4
  it('keeps loaded rows when Load more fails, and repeats the same continuation on Retry', async () => {
    const continuations: Array<string | null> = [];
    let failNext = true;
    server.use(
      http.post(RECORDING_SEARCH_URL, async ({ request }) => {
        const { continue: token = null } = (await request.json()) as { continue?: string };
        continuations.push(token);
        if (!token) {
          return HttpResponse.json({
            items: [ruleItem('rule-1', 'cpu_usage:avg', 'folder-1')],
            metadata: { continue: 'tok' },
          });
        }
        if (failNext) {
          failNext = false;
          return HttpResponse.json({ message: 'boom' }, { status: 500 });
        }
        return HttpResponse.json({ items: [ruleItem('rule-2', 'mem_usage:avg', 'folder-2')], metadata: {} });
      })
    );

    render(<RecordingRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    await screen.findByText('cpu_usage:avg');
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Failed to load more results')).toBeInTheDocument();
    expect(screen.getByText('cpu_usage:avg')).toBeInTheDocument();
    expect(continuations).toEqual([null, 'tok']);

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('mem_usage:avg')).toBeInTheDocument();
    expect(continuations).toEqual([null, 'tok', 'tok']);
  });

  it('shows a retryable error inside an expanded folder whose rule search failed', async () => {
    mockFolderSearch(() => ({ items: [folderItem('folder-1', 'Team Alerts')], metadata: {} }));
    failFirstCall(RECORDING_SEARCH_URL, { items: [ruleItem('rule-1', 'cpu_usage:avg', 'folder-1')], metadata: {} });

    render(<RecordingRulesPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Expand Team Alerts', expanded: false }));

    expect(await screen.findByText('Failed to load rules')).toBeInTheDocument();
    expect(screen.queryByText('No Recording rules in this folder')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('cpu_usage:avg')).toBeInTheDocument();
  });

  it('pages through folders with Next and Previous, and keeps the page when the next one fails', async () => {
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

    render(<RecordingRulesPage />);
    await screen.findByText('Team Alerts');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Failed to load more results')).toBeInTheDocument();
    expect(screen.getByText('Team Alerts')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Infra')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(await screen.findByText('Team Alerts')).toBeInTheDocument();
  });

  // STATE-1
  it('shows the empty state for a successful empty List response', async () => {
    mockRecordingRuleSearch(() => ({ items: [], metadata: {} }));

    render(<RecordingRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    expect(await screen.findByText('No Recording rules found')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // STATE-1
  it('restarts from the first page when Retry follows a rejected continuation token', async () => {
    const continuations: Array<string | null> = [];
    server.use(
      http.post(RECORDING_SEARCH_URL, async ({ request }) => {
        const { continue: token = null } = (await request.json()) as { continue?: string };
        continuations.push(token);
        if (token === 'stale-token') {
          return HttpResponse.json({ message: 'token expired' }, { status: 410 });
        }
        return HttpResponse.json({
          items: [ruleItem('rule-1', 'cpu_usage:avg', 'folder-1')],
          metadata: { continue: 'stale-token' },
        });
      })
    );

    render(<RecordingRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    await screen.findByText('cpu_usage:avg');
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await screen.findByText('Failed to load more results');

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('button', { name: 'Load more' })).toBeInTheDocument();
    expect(continuations).toEqual([null, 'stale-token', null]);
    expect(screen.getAllByText('cpu_usage:avg')).toHaveLength(1);
  });

  // STATE-4
  it('loads one page once when Load more is double clicked', async () => {
    const continuations: Array<string | null> = [];
    let releasePage: () => void = () => {};
    const pageGate = new Promise<void>((resolve) => {
      releasePage = resolve;
    });
    server.use(
      http.post(RECORDING_SEARCH_URL, async ({ request }) => {
        const { continue: token = null } = (await request.json()) as { continue?: string };
        continuations.push(token);
        if (!token) {
          return HttpResponse.json({
            items: [ruleItem('rule-1', 'cpu_usage:avg', 'folder-1')],
            metadata: { continue: 'tok' },
          });
        }
        await pageGate;
        return HttpResponse.json({ items: [ruleItem('rule-2', 'mem_usage:avg', 'folder-2')], metadata: {} });
      })
    );

    render(<RecordingRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });

    await screen.findByText('cpu_usage:avg');
    await userEvent.dblClick(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load more' })).toBeDisabled());
    releasePage();

    expect(await screen.findByText('mem_usage:avg')).toBeInTheDocument();
    expect(continuations).toEqual([null, 'tok']);
  });

  // STATE-3
  it('starts new criteria at the first page and never shows a late response for the replaced criteria', async () => {
    let releaseOldResponse: () => void = () => {};
    const oldResponseGate = new Promise<void>((resolve) => {
      releaseOldResponse = resolve;
    });
    const requests: Array<{ where?: unknown; token: string | null }> = [];
    server.use(
      http.post(RECORDING_SEARCH_URL, async ({ request }) => {
        const body = (await request.json()) as { where?: unknown; continue?: string };
        requests.push({ where: body.where, token: body.continue ?? null });
        if (!body.where) {
          await oldResponseGate;
          return HttpResponse.json({
            items: [ruleItem('rule-old', 'old_criteria:avg', 'folder-1')],
            metadata: { continue: 'old-tok' },
          });
        }
        return HttpResponse.json({ items: [ruleItem('rule-new', 'new_criteria:avg', 'folder-1')], metadata: {} });
      })
    );
    const user = userEvent.setup();

    render(<RecordingRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });
    await waitFor(() => expect(requests).toHaveLength(1));

    await user.type(await screen.findByRole('textbox', { name: 'Search' }), 'cpu{Enter}');
    expect(await screen.findByText('new_criteria:avg')).toBeInTheDocument();

    releaseOldResponse();
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]).toEqual({ where: { text: { value: 'cpu' } }, token: null });
    expect(screen.getByText('new_criteria:avg')).toBeInTheDocument();
    expect(screen.queryByText('old_criteria:avg')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  // STATE-1
  it('shows a retryable error instead of the empty state when the first folder page fails', async () => {
    failFirstCall(FOLDER_SEARCH_URL, { items: [folderItem('folder-1', 'Team Alerts')], metadata: {} });

    render(<RecordingRulesPage />);

    expect(await screen.findByText('Failed to load folders')).toBeInTheDocument();
    expect(screen.queryByText('No folders found')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Team Alerts')).toBeInTheDocument();
  });

  // STATE-1
  it('shows the empty state for a successful empty folder page', async () => {
    mockFolderSearch(() => ({ items: [], metadata: {} }));

    render(<RecordingRulesPage />);

    expect(await screen.findByText('No folders found')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load folders')).not.toBeInTheDocument();
  });

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

  it('shows a disabled Saved searches control until the legacy copy settles, then an interactive one', async () => {
    mockFolderSearch(() => ({ items: [], metadata: {} }));

    render(<RecordingRulesPage />);

    expect(screen.getByRole('button', { name: 'Saved searches' })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Saved searches' })).toBeEnabled());
  });

  describe('search and filters', () => {
    function urlSearchParams() {
      return new URLSearchParams(locationService.getLocation().search);
    }

    let ruleSearchBodies: Array<{ where?: unknown }>;

    beforeEach(() => {
      localStorage.clear();
      mockFolderSearch(() => ({
        items: [folderItem('folder-1', 'Team Alerts'), folderItem('folder-2', 'Infra')],
        metadata: {},
      }));
      ruleSearchBodies = [];
      mockRecordingRuleSearch((body) => {
        ruleSearchBodies.push(body as { where?: unknown });
        return { items: [ruleItem('rule-1', 'CPU recorded', 'folder-1')], metadata: {} };
      });
    });

    // SEARCH-1
    it('keeps a multi-token query exactly as typed and sends the applied criteria as one request', async () => {
      const user = userEvent.setup();
      render(<RecordingRulesPage />);
      const typed = 'metric:cpu_usage  cpu health:ok';

      await user.type(await screen.findByRole('textbox', { name: 'Search' }), `${typed}{Enter}`);

      expect(await screen.findByText('CPU recorded')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue(typed);
      expect(urlSearchParams().get('search')).toBe('metric:cpu_usage health:ok cpu');
      expect(ruleSearchBodies.at(-1)?.where).toEqual({
        and: [
          { text: { value: 'cpu' } },
          { filter: { field: 'metric', operator: 'In', values: ['cpu_usage'] } },
          { filter: { field: 'health', operator: 'In', values: ['Recording'] } },
        ],
      });
    });

    // SEARCH-5
    it('sends health In [NoData] for health:nodata and shows it in the sidebar', async () => {
      render(<RecordingRulesPage />, { historyOptions: { initialEntries: ['/?search=health%3Anodata&view=list'] } });

      expect(await screen.findByText('CPU recorded')).toBeInTheDocument();
      expect(ruleSearchBodies.at(-1)?.where).toEqual({
        filter: { field: 'health', operator: 'In', values: ['NoData'] },
      });
      expect(screen.getByRole('combobox', { name: 'Health' })).toHaveValue('No data');
    });

    // NAV-5
    it('shows an Alert-only state token as an invalid filter and sends no request', async () => {
      render(<RecordingRulesPage />, { historyOptions: { initialEntries: ['/?search=state%3Afiring&view=list'] } });

      expect(await screen.findByText('Some filters could not be applied: state')).toBeInTheDocument();
      expect(screen.getByText('Fix the invalid filter to see results')).toBeInTheDocument();
      expect(ruleSearchBodies).toEqual([]);
    });

    // SEARCH-7
    it('applying a filter switches to List with Folders disabled, and clearing it returns to Folders', async () => {
      const user = userEvent.setup();
      render(<RecordingRulesPage />);
      expect(await screen.findByRole('radio', { name: 'Folders' })).toBeChecked();

      await user.type(screen.getByRole('textbox', { name: 'Search' }), 'cpu{Enter}');

      expect(await screen.findByText('CPU recorded')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'List' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Folders' })).toBeDisabled();

      await user.click(screen.getByRole('button', { name: 'Clear filters' }));

      expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Folders' })).toBeChecked();
    });

    // SEARCH-2
    it('Back and Forward restore the search input, the sidebar, the mode and the request for each applied query', async () => {
      const user = userEvent.setup();
      render(<RecordingRulesPage />);
      await user.type(await screen.findByRole('textbox', { name: 'Search' }), 'cpu{Enter}');
      await screen.findByText('CPU recorded');
      await user.click(screen.getByRole('switch', { name: 'Hide plugin rules' }));
      await waitFor(() => expect(urlSearchParams().get('search')).toBe('plugins:hide cpu'));

      act(() => locationService.getHistory().goBack());

      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('cpu'));
      expect(screen.getByRole('switch', { name: 'Hide plugin rules' })).not.toBeChecked();
      await waitFor(() => expect(ruleSearchBodies.at(-1)?.where).toEqual({ text: { value: 'cpu' } }));

      act(() => locationService.getHistory().goBack());

      expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('');
      expect(screen.getByRole('radio', { name: 'Folders' })).toBeChecked();

      act(() => locationService.getHistory().goForward());
      act(() => locationService.getHistory().goForward());

      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('plugins:hide cpu'));
      expect(screen.getByRole('switch', { name: 'Hide plugin rules' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'List' })).toBeChecked();
      await waitFor(() =>
        expect(ruleSearchBodies.at(-1)?.where).toEqual({
          and: [
            { text: { value: 'cpu' } },
            { regex: { field: 'labels', pattern: '__grafana_origin=plugin/.*', negate: true } },
          ],
        })
      );
    });

    // SEARCH-2
    it('rendering again from the URL restores the input, the sidebar and the request', async () => {
      const user = userEvent.setup();
      const { unmount } = render(<RecordingRulesPage />);
      await user.type(
        await screen.findByRole('textbox', { name: 'Search' }),
        'cpu metric:cpu_usage health:error label:team=api{Enter}'
      );
      await screen.findByText('CPU recorded');
      const { pathname, search } = locationService.getLocation();
      unmount();
      ruleSearchBodies.length = 0;

      render(<RecordingRulesPage />, { historyOptions: { initialEntries: [`${pathname}${search}`] } });

      expect(await screen.findByText('CPU recorded')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue(
        'label:team=api metric:cpu_usage health:error cpu'
      );
      expect(screen.getByRole('textbox', { name: 'Label key' })).toHaveValue('team');
      expect(screen.getByRole('textbox', { name: 'Recorded metric' })).toHaveValue('cpu_usage');
      expect(screen.getByRole('combobox', { name: 'Health' })).toHaveValue('Error');
      expect(screen.getByRole('radio', { name: 'List' })).toBeChecked();
      expect(ruleSearchBodies.at(-1)?.where).toEqual({
        and: [
          { text: { value: 'cpu' } },
          { filter: { field: 'labels', operator: 'In', values: ['team=api'] } },
          { filter: { field: 'metric', operator: 'In', values: ['cpu_usage'] } },
          { filter: { field: 'health', operator: 'In', values: ['Error'] } },
        ],
      });
    });

    // SAVE-1
    describe('saved searches', () => {
      const ALERT_SEARCH = {
        id: 'alert-1',
        name: 'Alert search',
        query: 'paused:true',
        isDefault: false,
        createdAt: 1,
      };

      async function readCollection(key: string): Promise<Array<{ name: string; query: string; isDefault: boolean }>> {
        return JSON.parse((await new UserStorage('alerting').getItem(key)) ?? '[]');
      }

      async function seed(key: string, searches: object[]) {
        await new UserStorage('alerting').setItem(key, JSON.stringify(searches));
      }

      async function openSavedSearches(user: ReturnType<typeof userEvent.setup>) {
        await waitFor(() => expect(screen.getByRole('button', { name: 'Saved searches' })).toBeEnabled());
        await user.click(screen.getByRole('button', { name: 'Saved searches' }));
      }

      it('saves, renames, sets as default and deletes a search in the Recording collection and leaves the Alert one untouched', async () => {
        const user = userEvent.setup();
        await seed('alertRulesSavedSearches', [ALERT_SEARCH]);
        render(<RecordingRulesPage />, { historyOptions: { initialEntries: ['/?search=cpu&view=list'] } });
        await screen.findByText('CPU recorded');
        await openSavedSearches(user);

        await user.click(await screen.findByRole('button', { name: 'Save current search' }));
        await user.type(await screen.findByPlaceholderText('Enter a name...'), 'CPU metrics');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(await screen.findByRole('link', { name: 'CPU metrics' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Alert search' })).not.toBeInTheDocument();
        expect(await readCollection('recordingRulesSavedSearches')).toEqual([
          expect.objectContaining({ name: 'CPU metrics', query: 'cpu', isDefault: false }),
        ]);

        await user.click(screen.getByRole('button', { name: 'Actions' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
        const nameInput = await screen.findByDisplayValue('CPU metrics');
        await user.clear(nameInput);
        await user.type(nameInput, 'Recorded CPU{Enter}');

        expect(await screen.findByRole('link', { name: 'Recorded CPU' })).toBeInTheDocument();
        expect(await readCollection('recordingRulesSavedSearches')).toEqual([
          expect.objectContaining({ name: 'Recorded CPU', query: 'cpu' }),
        ]);

        await user.click(screen.getByRole('button', { name: 'Actions' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Set as default' }));

        await waitFor(async () =>
          expect(await readCollection('recordingRulesSavedSearches')).toEqual([
            expect.objectContaining({ name: 'Recorded CPU', isDefault: true }),
          ])
        );

        await user.click(screen.getByRole('button', { name: 'Actions' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
        await user.click(await screen.findByRole('button', { name: 'Delete' }));

        await waitFor(async () => expect(await readCollection('recordingRulesSavedSearches')).toEqual([]));
        expect(await readCollection('alertRulesSavedSearches')).toEqual([ALERT_SEARCH]);
      });

      it('applying a saved search updates the input, the sidebar, the URL and the request, and lists only Recording searches', async () => {
        const user = userEvent.setup();
        await seed('recordingRulesSavedSearches', [
          { id: 'rec-1', name: 'Failing metrics', query: 'cpu health:error', isDefault: false, createdAt: 1 },
        ]);
        await seed('alertRulesSavedSearches', [ALERT_SEARCH]);
        render(<RecordingRulesPage />);
        expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
        await openSavedSearches(user);

        expect(await screen.findByRole('link', { name: 'Failing metrics' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Alert search' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('link', { name: 'Failing metrics' }));

        expect(await screen.findByText('CPU recorded')).toBeInTheDocument();
        expect(urlSearchParams().get('search')).toBe('health:error cpu');
        expect(urlSearchParams().get('view')).toBe('list');
        expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('health:error cpu');
        expect(screen.getByRole('combobox', { name: 'Health' })).toHaveValue('Error');
        expect(ruleSearchBodies.at(-1)?.where).toEqual({
          and: [{ text: { value: 'cpu' } }, { filter: { field: 'health', operator: 'In', values: ['Error'] } }],
        });
      });
    });

    // SAVE-3
    it('applies the Recording default saved search, not the Alert one, when the page opens with no query', async () => {
      const storage = new UserStorage('alerting');
      await storage.setItem(
        'recordingRulesSavedSearches',
        JSON.stringify([
          { id: 'rec-1', name: 'Recording default', query: 'health:error', isDefault: true, createdAt: 1 },
        ])
      );
      await storage.setItem(
        'alertRulesSavedSearches',
        JSON.stringify([{ id: 'alert-1', name: 'Alert default', query: 'cpu', isDefault: true, createdAt: 1 }])
      );

      render(<RecordingRulesPage />);

      expect(await screen.findByText('CPU recorded')).toBeInTheDocument();
      expect(urlSearchParams().get('search')).toBe('health:error');
      expect(ruleSearchBodies.map((body) => body.where)).toEqual([
        { filter: { field: 'health', operator: 'In', values: ['Error'] } },
      ]);
    });

    it('does not apply the default saved search when the URL already has a query', async () => {
      await new UserStorage('alerting').setItem(
        'recordingRulesSavedSearches',
        JSON.stringify([
          { id: 'rec-1', name: 'Recording default', query: 'health:error', isDefault: true, createdAt: 1 },
        ])
      );

      render(<RecordingRulesPage />, { historyOptions: { initialEntries: ['/?search=namespace%3Afolder-1'] } });

      expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Saved searches' })).toBeEnabled());
      expect(urlSearchParams().get('search')).toBe('namespace:folder-1');
    });
  });
});
