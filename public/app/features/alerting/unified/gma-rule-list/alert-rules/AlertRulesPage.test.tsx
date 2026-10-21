import { HttpResponse, http } from 'msw';
import { Suspense } from 'react';
import { act, render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { locationService, reportInteraction } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';
import { mockComboboxRect } from '@grafana/test-utils';
import server from '@grafana/test-utils/server';
import { AccessControlAction } from 'app/types/accessControl';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';
import { folderItem, ruleItem } from '../mocks/factories';
import {
  FOLDER_COUNTS_URL,
  FOLDER_SEARCH_URL,
  failFirstCall,
  mockFolderCounts,
  mockFolderParents,
  mockFolderSearch,
  mockFullRule,
  mockRuleSearch,
  ruleSearchUrl,
  ruleUrl,
} from '../mocks/handlers';

import AlertRulesPage from './AlertRulesPage';

// test-utils replaces locationService per render; a spread would freeze the first one.
jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return Object.defineProperty({ ...actual, reportInteraction: jest.fn() }, 'locationService', {
    enumerable: true,
    get: () => actual.locationService,
  });
});

const reportInteractionMock = jest.mocked(reportInteraction);

// Combobox measures its floating element; jsdom reports zero.
mockComboboxRect();

setupMswServer();

const PAUSED_FALSE = { filter: { field: 'paused', operator: 'In', values: ['false'] } };

// GrafanaRoute provides this boundary in the app; the page suspends until saved searches are set up.
function renderPage(options?: Parameters<typeof render>[1]) {
  // eslint-disable-next-line testing-library/no-unnecessary-act
  return act(async () =>
    render(
      <Suspense>
        <AlertRulesPage />
      </Suspense>,
      options
    )
  );
}

describe('AlertRulesPage', () => {
  beforeEach(() => {
    reportInteractionMock.mockClear();
    setupDataSources();
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);
    mockFolderParents({ 'folder-1': 'Team Alerts', 'folder-2': 'Infra' });
    mockFolderCounts('alert', { 'folder-1': 3, 'folder-2': 0 });
    mockFullRule('alert');
  });

  it('Folders mode starts with collapsed, title-sorted folders showing their direct Alert-rule count', async () => {
    mockFolderSearch(() => ({
      items: [folderItem('folder-1', 'Team Alerts'), folderItem('folder-2', 'Infra')],
      metadata: {},
    }));

    await renderPage();

    expect(await screen.findByText('Team Alerts')).toBeInTheDocument();
    expect(screen.getByText('Infra')).toBeInTheDocument();
    expect(await screen.findByText('3 alert rules')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team Alerts' })).toHaveAttribute(
      'href',
      '/dashboards/f/folder-1/team-alerts/alerting'
    );
    expect(screen.queryByText('CPU high')).not.toBeInTheDocument();
  });

  it('a folder criterion in Folders mode scopes the folder listing to just that folder', async () => {
    let lastWhere: unknown;
    server.use(
      http.post(FOLDER_SEARCH_URL, async ({ request }) => {
        const body = (await request.json()) as { where?: unknown };
        lastWhere = body.where;
        return HttpResponse.json({ items: [folderItem('folder-1', 'Team Alerts')], metadata: {} });
      })
    );

    await renderPage({ historyOptions: { initialEntries: ['/?search=namespace%3Afolder-1'] } });

    expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeChecked();
    expect(lastWhere).toEqual({ filter: { field: 'name', operator: 'In', values: ['folder-1'] } });
  });

  it('expanding a folder loads only that folder Alert rules; collapsed folders issue no rule request', async () => {
    mockFolderSearch(() => ({
      items: [folderItem('folder-1', 'Team Alerts'), folderItem('folder-2', 'Infra')],
      metadata: {},
    }));

    let ruleSearchCalls = 0;
    let lastFolderFilter: string[] | undefined;
    mockRuleSearch('alert', (body) => {
      ruleSearchCalls += 1;
      const searchBody = body as { where?: { filter?: { values: string[] } } };
      lastFolderFilter = searchBody.where?.filter?.values;
      return { items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')], metadata: {} };
    });

    await renderPage();
    await screen.findByText('Team Alerts');

    expect(ruleSearchCalls).toBe(0);

    await userEvent.click(screen.getByRole('button', { name: 'Expand Team Alerts', expanded: false }));

    await screen.findByText('CPU high');
    expect(ruleSearchCalls).toBe(1);
    expect(lastFolderFilter).toEqual(['folder-1']);
  });

  it('List mode shows title-sorted Alert rules with the full folder path and issues no folder-count requests', async () => {
    let countRequests = 0;
    server.use(
      http.get(FOLDER_COUNTS_URL, () => {
        countRequests += 1;
        return HttpResponse.json({ counts: [] });
      })
    );
    mockRuleSearch('alert', () => ({
      items: [
        ruleItem('alert', 'rule-1', 'CPU high', 'folder-1'),
        ruleItem('alert', 'rule-2', 'Disk full', 'folder-2'),
      ],
      metadata: {},
    }));

    await renderPage({ historyOptions: { initialEntries: ['/?view=list'] } });

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    expect(screen.getByText('Disk full')).toBeInTheDocument();
    await screen.findByText('Team Alerts');
    await screen.findByText('Infra');
    expect(countRequests).toBe(0);
  });

  it('shows an empty state for a successful empty List response', async () => {
    mockRuleSearch('alert', () => ({ items: [], metadata: {} }));

    await renderPage({ historyOptions: { initialEntries: ['/?view=list'] } });

    expect(await screen.findByText('No Alert rules found')).toBeInTheDocument();
  });

  it('sends the List search to searchAlertRules with the filter as the request body', async () => {
    let body: unknown;
    mockRuleSearch('alert', (received) => {
      body = received;
      return { items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')], metadata: {} };
    });

    await renderPage({ historyOptions: { initialEntries: ['/?search=paused%3Afalse&view=list'] } });

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    expect(body).toMatchObject({
      kind: 'SearchQuery',
      where: PAUSED_FALSE,
    });
  });

  it('retries a failed first List page and then shows its rules', async () => {
    const callCount = failFirstCall(ruleSearchUrl('alert'), {
      items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')],
      metadata: {},
    });

    await renderPage({ historyOptions: { initialEntries: ['/?view=list'] } });

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load rules');
    expect(screen.queryByText('No Alert rules found')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    expect(callCount()).toBe(2);
  });

  it('keeps loaded rows visible when Load more fails and repeats the same continuation request on Retry', async () => {
    const continuations: Array<string | null> = [];
    let failNext = true;
    server.use(
      http.post(ruleSearchUrl('alert'), async ({ request }) => {
        const { continue: token = null } = (await request.json()) as { continue?: string };
        continuations.push(token);
        if (!token) {
          return HttpResponse.json({
            items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')],
            metadata: { continue: 'tok' },
          });
        }
        if (failNext) {
          failNext = false;
          return HttpResponse.json({ message: 'boom' }, { status: 500 });
        }
        return HttpResponse.json({ items: [ruleItem('alert', 'rule-2', 'Disk full', 'folder-2')], metadata: {} });
      })
    );

    await renderPage({ historyOptions: { initialEntries: ['/?view=list'] } });

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Failed to load more results')).toBeInTheDocument();
    expect(screen.getByText('CPU high')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Disk full')).toBeInTheDocument();
    expect(screen.getByText('CPU high')).toBeInTheDocument();
    expect(continuations).toEqual([null, 'tok', 'tok']);
  });

  it('loads one page once when Load more is double clicked', async () => {
    const continuations: Array<string | null> = [];
    let releasePage: () => void = () => {};
    const pageGate = new Promise<void>((resolve) => {
      releasePage = resolve;
    });
    server.use(
      http.post(ruleSearchUrl('alert'), async ({ request }) => {
        const { continue: token = null } = (await request.json()) as { continue?: string };
        continuations.push(token);
        if (!token) {
          return HttpResponse.json({
            items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')],
            metadata: { continue: 'tok' },
          });
        }
        await pageGate;
        return HttpResponse.json({ items: [ruleItem('alert', 'rule-2', 'Disk full', 'folder-2')], metadata: {} });
      })
    );

    await renderPage({ historyOptions: { initialEntries: ['/?view=list'] } });

    await screen.findByText('CPU high');
    await userEvent.dblClick(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load more' })).toBeDisabled());
    releasePage();

    expect(await screen.findByText('Disk full')).toBeInTheDocument();
    expect(continuations).toEqual([null, 'tok']);
  });

  it('shows a retryable error inside an expanded folder whose rule search failed', async () => {
    mockFolderSearch(() => ({ items: [folderItem('folder-1', 'Team Alerts')], metadata: {} }));
    failFirstCall(ruleSearchUrl('alert'), {
      items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')],
      metadata: {},
    });

    await renderPage();
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
      http.post(ruleSearchUrl('alert'), async ({ request }) => {
        const body = (await request.json()) as { where?: { filter?: { values: string[] } }; continue?: string };
        requested.push({ folders: body.where?.filter?.values, token: body.continue ?? null });
        return body.continue
          ? HttpResponse.json({ items: [ruleItem('alert', 'rule-2', 'Disk full', 'folder-1')], metadata: {} })
          : HttpResponse.json({
              items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')],
              metadata: { continue: 'tok' },
            });
      })
    );

    await renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Expand Team Alerts', expanded: false }));
    await screen.findByText('CPU high');
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Disk full')).toBeInTheDocument();
    expect(requested).toEqual([
      { folders: ['folder-1'], token: null },
      { folders: ['folder-1'], token: 'tok' },
    ]);
  });

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

    await renderPage();

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

    await renderPage();
    await screen.findByText('Team Alerts');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Failed to load more results')).toBeInTheDocument();
    expect(screen.getByText('Team Alerts')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Infra')).toBeInTheDocument();
  });

  it('shows a retryable error instead of the empty state when the first folder page fails', async () => {
    failFirstCall(FOLDER_SEARCH_URL, { items: [folderItem('folder-1', 'Team Alerts')], metadata: {} });

    await renderPage();

    expect(await screen.findByText('Failed to load folders')).toBeInTheDocument();
    expect(screen.queryByText('No folders found')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Team Alerts')).toBeInTheDocument();
  });

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
      http.post(ruleSearchUrl('alert'), () => {
        searchRequests += 1;
        return HttpResponse.json({ items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')], metadata: {} });
      }),
      http.get(ruleUrl('alert'), ({ params }) =>
        HttpResponse.json({
          apiVersion: 'v0alpha1',
          kind: 'AlertRule',
          metadata: { name: params.name, annotations: { 'grafana.com/access/canWrite': 'true' } },
          spec: { title: 'CPU high', paused },
        })
      ),
      http.patch(ruleUrl('alert'), () => {
        paused = true;
        return HttpResponse.json({});
      })
    );

    await renderPage();
    expect(await screen.findByText('3 alert rules')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Team Alerts', expanded: false }));
    await screen.findByText('CPU high');

    const ruleRow = await screen.findByRole('listitem', { name: 'CPU high' });
    await userEvent.click(await within(ruleRow).findByRole('button', { name: /more/i }));
    // Disabled as "Pause: Checking permissions..." until the full rule loads; waiting for the plain name waits for that.
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Pause' }));

    expect(await screen.findByText('2 alert rules')).toBeInTheDocument();
    await waitFor(() => expect(searchRequests).toBe(2));
    expect(countRequests).toBe(2);
    await userEvent.click(await within(ruleRow).findByRole('button', { name: /more/i }));
    expect(await screen.findByRole('menuitem', { name: 'Resume' })).toBeInTheDocument();
  });

  it('emits grafana_alerting_gma_rule_list_view once per mount with the kind and mode, not again on re-render', async () => {
    mockFolderSearch(() => ({ items: [], metadata: {} }));
    mockRuleSearch('alert', () => ({ items: [], metadata: {} }));
    const pageViewCalls = () =>
      reportInteractionMock.mock.calls.filter(([event]) => event === 'grafana_alerting_gma_rule_list_view');

    const { rerender } = await renderPage({ historyOptions: { initialEntries: ['/?view=list'] } });
    await screen.findByText('No Alert rules found');
    expect(pageViewCalls()).toEqual([['grafana_alerting_gma_rule_list_view', { kind: 'alert', mode: 'list' }]]);

    rerender(
      <Suspense>
        <AlertRulesPage />
      </Suspense>
    );
    await screen.findByText('No Alert rules found');

    expect(pageViewCalls()).toHaveLength(1);
  });

  it('lists a legacy saved search as soon as the page shows', async () => {
    mockFolderSearch(() => ({ items: [], metadata: {} }));
    localStorage.clear();
    await new UserStorage('alerting').setItem(
      'savedSearches',
      JSON.stringify([{ id: 'legacy-1', name: 'Legacy CPU', query: 'cpu', isDefault: false, createdAt: 1 }])
    );

    const { user } = await renderPage();
    await user.click(screen.getByRole('button', { name: 'Saved searches' }));

    expect(await screen.findByRole('link', { name: 'Legacy CPU' })).toBeInTheDocument();
  });
});

describe('AlertRulesPage search and filters', () => {
  let ruleSearchBodies: Array<{ where?: unknown }>;

  function whereOf(body: { where?: unknown } | undefined) {
    return body?.where;
  }

  function urlSearchParams() {
    return new URLSearchParams(locationService.getLocation().search);
  }

  beforeEach(() => {
    localStorage.clear();
    grantUserPermissions([AccessControlAction.AlertingRuleRead]);
    setupDataSources(
      mockDataSource({ uid: 'ds-1', name: 'Prometheus' }),
      mockDataSource({ uid: 'ds-2', name: 'Loki' })
    );
    mockFolderParents({ 'folder-1': 'Team Alerts', 'folder-2': 'Infra' });
    mockFolderCounts('alert', { 'folder-1': 3, 'folder-2': 1 });
    mockFolderSearch(() => ({
      items: [folderItem('folder-1', 'Team Alerts'), folderItem('folder-2', 'Infra')],
      metadata: {},
    }));
    ruleSearchBodies = [];
    mockRuleSearch('alert', (body) => {
      ruleSearchBodies.push(body as { where?: unknown });
      return { items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')], metadata: {} };
    });
    mockFullRule('alert');
  });

  it('keeps a multi-token query exactly as typed, puts the applied filter in the URL and sends it as one request', async () => {
    const { user } = await renderPage();
    const typed = 'paused:false cpu label:team=api  namespace:folder-1';

    await user.type(await screen.findByRole('textbox', { name: 'Search' }), `${typed}{Enter}`);

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue(typed);
    expect(urlSearchParams().get('search')).toBe('namespace:folder-1 label:team=api paused:false cpu');
    expect(urlSearchParams().get('view')).toBe('list');
    expect(whereOf(ruleSearchBodies.at(-1))).toEqual({
      and: [
        { text: { value: 'cpu' } },
        { filter: { field: 'folder', operator: 'In', values: ['folder-1'] } },
        { filter: { field: 'labels', operator: 'In', values: ['team=api'] } },
        PAUSED_FALSE,
      ],
    });
  });

  it('the search input follows a sidebar change', async () => {
    const { user } = await renderPage({ historyOptions: { initialEntries: ['/?search=cpu&view=list'] } });
    await screen.findByText('CPU high');

    await user.click(screen.getByRole('switch', { name: 'Hide plugin rules' }));

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('plugins:hide cpu'));
  });

  it.each([
    { search: 'policy%3Adefault', key: 'policy' },
    { search: 'foo%3Abar%20cpu', key: 'foo' },
    { search: 'metric%3Acpu_usage', key: 'metric' },
  ])('names the invalid $key filter, keeps the query as typed and sends no request', async ({ search, key }) => {
    await renderPage({ historyOptions: { initialEntries: [`/?search=${search}&view=list`] } });

    expect(await screen.findByText('Fix the invalid filter to see results')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue(decodeURIComponent(search));
    expect(screen.getByText(`Some filters could not be applied: ${key}`)).toBeInTheDocument();
    expect(ruleSearchBodies).toEqual([]);
  });

  it('sends the mapped state and health values for legacy token spellings', async () => {
    await renderPage({
      historyOptions: { initialEntries: ['/?search=state%3Anormal%20health%3Aerr&view=list'] },
    });

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    expect(whereOf(ruleSearchBodies.at(-1))).toEqual({
      and: [
        { filter: { field: 'state', operator: 'In', values: ['Healthy', 'Inactive'] } },
        { filter: { field: 'health', operator: 'In', values: ['Error'] } },
      ],
    });
    expect(screen.getByRole('combobox', { name: 'Alert state' })).toHaveValue('Normal');
    expect(screen.getByRole('combobox', { name: 'Health' })).toHaveValue('Error');
  });

  it('shows every folder and data source from the URL, sends each as one In and edits them from the sidebar', async () => {
    const { user } = await renderPage({
      historyOptions: {
        initialEntries: [
          '/?search=namespace%3Afolder-1%20namespace%3Afolder-2%20datasource%3Ads-1%20datasource%3Ads-2&view=list',
        ],
      },
    });

    expect(await screen.findByRole('button', { name: 'Remove Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Infra' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Prometheus' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Loki' })).toBeInTheDocument();
    await waitFor(() =>
      expect(whereOf(ruleSearchBodies.at(-1))).toEqual({
        and: [
          { filter: { field: 'folder', operator: 'In', values: ['folder-1', 'folder-2'] } },
          { filter: { field: 'datasourceUIDs', operator: 'In', values: ['ds-1', 'ds-2'] } },
        ],
      })
    );

    await user.click(screen.getByRole('button', { name: 'Remove Team Alerts' }));
    await user.click(screen.getByRole('button', { name: 'Remove Loki' }));

    await waitFor(() =>
      expect(whereOf(ruleSearchBodies.at(-1))).toEqual({
        and: [
          { filter: { field: 'folder', operator: 'In', values: ['folder-2'] } },
          { filter: { field: 'datasourceUIDs', operator: 'In', values: ['ds-1'] } },
        ],
      })
    );
    expect(urlSearchParams().get('search')).toBe('namespace:folder-2 datasource:ds-1');
  });

  it('keeps a label row with only a key in the sidebar without changing the URL or the request, and sends it once it has a value', async () => {
    const { user } = await renderPage({ historyOptions: { initialEntries: ['/?view=list'] } });
    await screen.findByText('CPU high');
    const requestsBefore = ruleSearchBodies.length;

    await user.click(screen.getByRole('button', { name: 'Add label filter' }));
    await user.type(screen.getByRole('textbox', { name: 'Label key' }), 'team{Enter}');

    expect(screen.getByRole('textbox', { name: 'Label key' })).toHaveValue('team');
    expect(urlSearchParams().has('search')).toBe(false);
    expect(ruleSearchBodies).toHaveLength(requestsBefore);

    await user.type(screen.getByRole('textbox', { name: 'Label value' }), 'api{Enter}');

    await waitFor(() =>
      expect(whereOf(ruleSearchBodies.at(-1))).toEqual({
        filter: { field: 'labels', operator: 'In', values: ['team=api'] },
      })
    );
    expect(urlSearchParams().get('search')).toBe('label:team=api');
  });

  it('explains an unsupported filter in the search input and sends no request', async () => {
    await renderPage({ historyOptions: { initialEntries: ['/?search=state%3Aerror'] } });

    expect(await screen.findByText('state:error is not a valid filter. Use health:error.')).toBeInTheDocument();
    expect(screen.getByText('Fix the invalid filter to see results')).toBeInTheDocument();
    expect(ruleSearchBodies).toEqual([]);
  });

  it('applying a non-folder filter switches to List, disables Folders with its tooltip, and clearing returns to Folders', async () => {
    const { user } = await renderPage();
    expect(await screen.findByRole('radio', { name: 'Folders' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeEnabled();

    await user.type(screen.getByRole('textbox', { name: 'Search' }), 'cpu{Enter}');

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'List' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeDisabled();
    await user.hover(screen.getByRole('radiogroup'));
    expect(await screen.findByText('Clear filters to browse by folder')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeEnabled();
    expect(urlSearchParams().has('view')).toBe(false);
  });

  it('Back and Forward restore the search input, the sidebar, the mode and the request for each applied query', async () => {
    const { user } = await renderPage();
    await user.type(await screen.findByRole('textbox', { name: 'Search' }), 'cpu{Enter}');
    await screen.findByText('CPU high');
    await user.click(screen.getByRole('switch', { name: 'Hide plugin rules' }));
    await waitFor(() => expect(urlSearchParams().get('search')).toBe('plugins:hide cpu'));

    act(() => locationService.getHistory().goBack());

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('cpu'));
    expect(screen.getByRole('switch', { name: 'Hide plugin rules' })).not.toBeChecked();
    await waitFor(() => expect(whereOf(ruleSearchBodies.at(-1))).toEqual({ text: { value: 'cpu' } }));

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
      expect(whereOf(ruleSearchBodies.at(-1))).toEqual({
        and: [
          { text: { value: 'cpu' } },
          { regex: { field: 'labels', pattern: '__grafana_origin=plugin/.*', negate: true } },
        ],
      })
    );
  });

  it('rendering again from the URL restores the input, the sidebar and the request', async () => {
    const { user, unmount } = await renderPage();
    await user.type(
      await screen.findByRole('textbox', { name: 'Search' }),
      'cpu namespace:folder-1 label:team=api paused:false{Enter}'
    );
    await screen.findByText('CPU high');
    const { pathname, search } = locationService.getLocation();
    unmount();
    ruleSearchBodies.length = 0;

    await renderPage({ historyOptions: { initialEntries: [`${pathname}${search}`] } });

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue(
      'namespace:folder-1 label:team=api paused:false cpu'
    );
    expect(screen.getByRole('textbox', { name: 'Label key' })).toHaveValue('team');
    expect(screen.getByRole('textbox', { name: 'Label value' })).toHaveValue('api');
    expect(screen.getByRole('combobox', { name: 'Paused' })).toHaveValue('Not paused');
    expect(await screen.findByRole('button', { name: 'Remove Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'List' })).toBeChecked();
    expect(whereOf(ruleSearchBodies.at(-1))).toEqual({
      and: [
        { text: { value: 'cpu' } },
        { filter: { field: 'folder', operator: 'In', values: ['folder-1'] } },
        { filter: { field: 'labels', operator: 'In', values: ['team=api'] } },
        PAUSED_FALSE,
      ],
    });
  });

  describe('saved searches', () => {
    const RECORDING_SEARCH = {
      id: 'rec-1',
      name: 'Recording search',
      query: 'health:error',
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

    it('saves, renames, sets as default and deletes a search in the Alert collection and leaves the Recording one untouched', async () => {
      await seed('recordingRulesSavedSearches', [RECORDING_SEARCH]);
      const { user } = await renderPage({ historyOptions: { initialEntries: ['/?search=cpu&view=list'] } });
      await screen.findByText('CPU high');
      await openSavedSearches(user);

      await user.click(await screen.findByRole('button', { name: 'Save current search' }));
      await user.type(await screen.findByPlaceholderText('Enter a name...'), 'CPU rules');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByRole('link', { name: 'CPU rules' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Recording search' })).not.toBeInTheDocument();
      expect(await readCollection('alertRulesSavedSearches')).toEqual([
        expect.objectContaining({ name: 'CPU rules', query: 'cpu', isDefault: false }),
      ]);

      await user.click(screen.getByRole('button', { name: 'Actions' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
      const nameInput = await screen.findByDisplayValue('CPU rules');
      await user.clear(nameInput);
      await user.type(nameInput, 'High CPU{Enter}');

      expect(await screen.findByRole('link', { name: 'High CPU' })).toBeInTheDocument();
      expect(await readCollection('alertRulesSavedSearches')).toEqual([
        expect.objectContaining({ name: 'High CPU', query: 'cpu' }),
      ]);

      await user.click(screen.getByRole('button', { name: 'Actions' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Set as default' }));

      await waitFor(async () =>
        expect(await readCollection('alertRulesSavedSearches')).toEqual([
          expect.objectContaining({ name: 'High CPU', isDefault: true }),
        ])
      );

      await user.click(screen.getByRole('button', { name: 'Actions' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
      await user.click(await screen.findByRole('button', { name: 'Delete' }));

      await waitFor(async () => expect(await readCollection('alertRulesSavedSearches')).toEqual([]));
      expect(await readCollection('recordingRulesSavedSearches')).toEqual([RECORDING_SEARCH]);
    });

    it('applying a saved search updates the input, the sidebar, the URL and the request, and lists only Alert searches', async () => {
      await seed('alertRulesSavedSearches', [
        { id: 'alert-1', name: 'Running rules', query: 'cpu paused:false', isDefault: false, createdAt: 1 },
      ]);
      await seed('recordingRulesSavedSearches', [RECORDING_SEARCH]);
      const { user } = await renderPage();
      expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
      await openSavedSearches(user);

      expect(await screen.findByRole('link', { name: 'Running rules' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Recording search' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('link', { name: 'Running rules' }));

      expect(await screen.findByText('CPU high')).toBeInTheDocument();
      expect(urlSearchParams().get('search')).toBe('paused:false cpu');
      expect(urlSearchParams().get('view')).toBe('list');
      expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('paused:false cpu');
      expect(screen.getByRole('combobox', { name: 'Paused' })).toHaveValue('Not paused');
      expect(whereOf(ruleSearchBodies.at(-1))).toEqual({
        and: [{ text: { value: 'cpu' } }, PAUSED_FALSE],
      });
    });
  });

  describe('default saved search', () => {
    async function seedDefaultSearch(query: string) {
      await new UserStorage('alerting').setItem(
        'alertRulesSavedSearches',
        JSON.stringify([{ id: 'saved-1', name: 'My default', query, isDefault: true, createdAt: 1 }])
      );
    }

    it('applies the default saved search when the page opens with no query, without an unfiltered request first', async () => {
      await seedDefaultSearch('cpu paused:false');

      await renderPage();

      expect(await screen.findByText('CPU high')).toBeInTheDocument();
      expect(urlSearchParams().get('search')).toBe('paused:false cpu');
      expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('paused:false cpu');
      expect(ruleSearchBodies.map(whereOf)).toEqual([{ and: [{ text: { value: 'cpu' } }, PAUSED_FALSE] }]);
    });

    it('does not apply the default saved search when the URL already has a query', async () => {
      await seedDefaultSearch('cpu paused:false');

      await renderPage({ historyOptions: { initialEntries: ['/?search=namespace%3Afolder-1'] } });

      expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Saved searches' })).toBeEnabled());
      expect(urlSearchParams().get('search')).toBe('namespace:folder-1');
      expect(ruleSearchBodies).toEqual([]);
    });

    it('does not apply the default saved search for an empty search parameter', async () => {
      await seedDefaultSearch('cpu paused:false');

      await renderPage({ historyOptions: { initialEntries: ['/?search='] } });

      expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Saved searches' })).toBeEnabled());
      expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('');
      expect(urlSearchParams().get('search')).toBe('');
      expect(ruleSearchBodies).toEqual([]);
    });

    it('Clear filters writes an empty search parameter, so the default is not applied again on reload', async () => {
      await seedDefaultSearch('cpu paused:false');
      const { user } = await renderPage();
      expect(await screen.findByText('CPU high')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Clear filters' }));

      expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
      expect(locationService.getLocation().search).toBe('?search=');
      expect(screen.getByRole('radio', { name: 'Folders' })).toBeChecked();
    });

    describe('applied saved search indicator', () => {
      async function seedSearches(searches: Array<{ name: string; query: string; isDefault: boolean }>) {
        await new UserStorage('alerting').setItem(
          'alertRulesSavedSearches',
          JSON.stringify(searches.map((search, i) => ({ id: `saved-${i}`, createdAt: 1, ...search })))
        );
      }

      it('names the default, with its star and "(default)", when it was applied on load', async () => {
        await seedSearches([{ name: 'My default', query: 'cpu paused:false', isDefault: true }]);

        await renderPage();

        expect(await screen.findByText('My default (default)')).toBeInTheDocument();
        expect(document.querySelector('[data-testid="icon-favorite"]')).toBeInTheDocument();
      });

      it('names a saved search applied from the menu with a bookmark and no "(default)"', async () => {
        await seedSearches([{ name: 'Running rules', query: 'cpu paused:false', isDefault: false }]);
        const { user } = await renderPage();
        await screen.findByRole('link', { name: 'Team Alerts' });
        expect(screen.queryByText('Running rules')).not.toBeInTheDocument();

        await user.click(await screen.findByRole('button', { name: 'Saved searches' }));
        await user.click(await screen.findByRole('link', { name: 'Running rules' }));
        await screen.findByText('CPU high');

        expect(await screen.findAllByText('Running rules')).not.toHaveLength(0);
        expect(screen.queryByText('Running rules (default)')).not.toBeInTheDocument();
      });

      it('names a saved search when a typed query happens to match it, and drops the name once it is edited', async () => {
        await seedSearches([{ name: 'Running rules', query: 'cpu paused:false', isDefault: false }]);
        const { user } = await renderPage({ historyOptions: { initialEntries: ['/?view=list'] } });
        await screen.findByText('CPU high');

        const input = screen.getByRole('textbox', { name: 'Search' });
        await user.type(input, 'paused:false cpu{Enter}');
        expect(await screen.findByText('Running rules')).toBeInTheDocument();

        await user.type(input, ' extra{Enter}');
        await waitFor(() => expect(screen.queryByText('Running rules')).not.toBeInTheDocument());
      });

      it('drops the name when the filters are cleared', async () => {
        await seedSearches([{ name: 'My default', query: 'cpu paused:false', isDefault: true }]);
        const { user } = await renderPage();
        expect(await screen.findByText('My default (default)')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Clear filters' }));

        await waitFor(() => expect(screen.queryByText('My default (default)')).not.toBeInTheDocument());
      });
    });
  });
});
