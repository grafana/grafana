import { HttpResponse, http } from 'msw';
import { act, render, screen, userEvent, waitFor } from 'test/test-utils';

import { locationService, reportInteraction } from '@grafana/runtime';
import server from '@grafana/test-utils/server';

import { setupMswServer } from '../../mockApi';
import { installControllableIntersectionObserver } from '../../mocks/intersectionObserver';
import { folderItem, ruleItem } from '../mocks/factories';
import {
  FOLDER_SEARCH_URL,
  type SearchRequestBody,
  failFirstCall,
  mockFolderCounts,
  mockFolderParents,
  mockFolderSearch,
  mockRuleSearch,
  ruleSearchUrl,
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

setupMswServer();

/**
 * Serves the first folder page with a continuation token; `nextPage` answers every request that carries one
 * and defaults to the last page.
 */
function mockPagedFolderSearch(nextPage: (token: string) => Response | Promise<Response> = lastFolderPage) {
  const continuations: Array<string | null> = [];
  server.use(
    http.post(FOLDER_SEARCH_URL, async ({ request }) => {
      const { continue: token } = (await request.json()) as { continue?: string };
      continuations.push(token ?? null);
      if (!token) {
        return HttpResponse.json({ items: [folderItem('folder-1', 'Team Alerts')], metadata: { continue: 'tok' } });
      }
      return nextPage(token);
    })
  );
  return continuations;
}

function lastFolderPage() {
  return HttpResponse.json({ items: [folderItem('folder-2', 'Infra')], metadata: {} });
}

/** Folders is the default view; List tests open the page with `view=list`. */
function renderInListMode() {
  return render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });
}

function secondPage() {
  return HttpResponse.json({ items: [ruleItem('alert', 'rule-2', 'Disk full', 'folder-2')], metadata: {} });
}

describe('AlertRulesPage', () => {
  beforeEach(() => {
    reportInteractionMock.mockClear();
    mockFolderParents({ 'folder-1': 'Team Alerts', 'folder-2': 'Infra' });
  });

  it('lists the Alert rules in the order the search returns them, each with its folder path', async () => {
    mockRuleSearch('alert', () => ({
      items: [
        ruleItem('alert', 'rule-1', 'CPU high', 'folder-1'),
        ruleItem('alert', 'rule-2', 'Disk full', 'folder-2'),
      ],
      metadata: {},
    }));

    renderInListMode();

    const rows = await screen.findAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('a')?.textContent)).toEqual(['CPU high', 'Disk full']);
    expect(await screen.findByText('Team Alerts')).toBeInTheDocument();
    expect(await screen.findByText('Infra')).toBeInTheDocument();
  });

  it('asks searchAlertRules for 40 rules sorted by title, with no filter', async () => {
    let body: unknown;
    mockRuleSearch('alert', (received) => {
      body = received;
      return { items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')], metadata: {} };
    });

    renderInListMode();

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    expect(body).toMatchObject({ kind: 'SearchQuery', sort: [{ field: 'title', direction: 'asc' }], limit: 40 });
    expect(body).not.toHaveProperty('where');
  });

  it("shows the first page's total as the result count", async () => {
    mockRuleSearch('alert', () => ({
      items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')],
      metadata: { totalHits: 154, totalHitsRelation: 'eq' },
    }));

    renderInListMode();

    expect(await screen.findByText('154 alert rules')).toBeInTheDocument();
  });

  it('shows skeleton rows in a busy list until the first page arrives', async () => {
    let releasePage: () => void = () => {};
    const pageGate = new Promise<void>((resolve) => {
      releasePage = resolve;
    });
    server.use(
      http.post(ruleSearchUrl('alert'), async () => {
        await pageGate;
        return HttpResponse.json({ items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')], metadata: {} });
      })
    );

    renderInListMode();

    expect(await screen.findByRole('list', { name: 'Loading rules' })).toHaveAttribute('aria-busy', 'true');
    releasePage();
    expect(await screen.findByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Loading rules' })).not.toBeInTheDocument();
  });

  it('shows the empty state after a successful empty response', async () => {
    mockRuleSearch('alert', () => ({ items: [], metadata: {} }));

    renderInListMode();

    expect(await screen.findByText('No alert rules found')).toBeInTheDocument();
  });

  it('shows a retryable error instead of the empty state when the first page fails', async () => {
    const callCount = failFirstCall('post', ruleSearchUrl('alert'), {
      items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')],
      metadata: {},
    });

    renderInListMode();

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load rules');
    expect(screen.queryByText('No alert rules found')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    expect(callCount()).toBe(2);
  });

  it('keeps loaded rows when Load more fails, and reloads them with fresh tokens on Retry', async () => {
    const continuations: Array<string | null> = [];
    let firstPages = 0;
    let failNext = true;
    server.use(
      http.post(ruleSearchUrl('alert'), async ({ request }) => {
        const { continue: token } = (await request.json()) as { continue?: string };
        continuations.push(token ?? null);
        if (!token) {
          firstPages += 1;
          return HttpResponse.json({
            items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')],
            // The reloaded first page hands out a new token, so a replayed one is detectable.
            metadata: { continue: firstPages === 1 ? 'tok' : 'tok-fresh' },
          });
        }
        if (token === 'tok' || token === 'tok-fresh') {
          return HttpResponse.json({
            items: [ruleItem('alert', 'rule-2', 'Disk full', 'folder-2')],
            metadata: { continue: 'tok-2' },
          });
        }
        if (failNext) {
          failNext = false;
          return HttpResponse.json({ message: 'expired' }, { status: 410 });
        }
        return HttpResponse.json({ items: [ruleItem('alert', 'rule-3', 'Memory high', 'folder-1')], metadata: {} });
      })
    );

    renderInListMode();

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    await screen.findByText('Disk full');
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Failed to load more results')).toBeInTheDocument();
    expect(screen.getByText('CPU high')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    // Retry reloads both loaded pages from the first one, taking the second page's token from the reloaded first page.
    await waitFor(() => expect(continuations).toEqual([null, 'tok', 'tok-2', null, 'tok-fresh']));
    expect(await screen.findByRole('button', { name: 'Load more' })).toBeEnabled();
    expect(screen.getByText('CPU high')).toBeInTheDocument();
    expect(screen.getByText('Disk full')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Memory high')).toBeInTheDocument();
  });

  it('keeps loaded rows and names the refresh as failed when the reload on Retry fails too', async () => {
    let calls = 0;
    server.use(
      http.post(ruleSearchUrl('alert'), () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({
            items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')],
            metadata: { continue: 'tok' },
          });
        }
        return HttpResponse.json({ message: 'boom' }, { status: 500 });
      })
    );

    renderInListMode();

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Failed to refresh results')).toBeInTheDocument();
    expect(screen.getByText('CPU high')).toBeInTheDocument();
  });

  it.each([
    {
      mode: 'list',
      mockEmpty: () => mockRuleSearch('alert', () => ({ items: [], metadata: {} })),
      renderPage: renderInListMode,
    },
    {
      mode: 'folders',
      mockEmpty: () => mockFolderSearch(() => ({ items: [], metadata: {} })),
      renderPage: () => render(<AlertRulesPage />),
    },
  ])(
    'reports one page view in $mode mode per mount, not again on re-render',
    async ({ mode, mockEmpty, renderPage }) => {
      mockEmpty();
      const pageViewCalls = () =>
        reportInteractionMock.mock.calls.filter(([event]) => event === 'grafana_alerting_gma_rule_list_view');

      const { rerender } = renderPage();
      await screen.findByText('No alert rules found');
      expect(pageViewCalls()).toEqual([['grafana_alerting_gma_rule_list_view', { kind: 'alert', mode }]]);

      rerender(<AlertRulesPage />);
      await screen.findByText('No alert rules found');

      expect(pageViewCalls()).toHaveLength(1);
    }
  );
});

describe('AlertRulesPage search', () => {
  let ruleSearchBodies: Array<{ where?: unknown; continue?: string }>;

  function searchParam() {
    return new URLSearchParams(locationService.getLocation().search).get('search');
  }

  function searchInput() {
    return screen.getByRole('textbox', { name: 'Search' });
  }

  beforeEach(() => {
    mockFolderParents({ 'folder-1': 'Team Alerts' });
    ruleSearchBodies = [];
    mockRuleSearch('alert', (body) => {
      ruleSearchBodies.push(body);
      return { items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')], metadata: {} };
    });
  });

  it('keeps a multi-token query exactly as typed in the input and the URL, and sends it as one request', async () => {
    const { user } = renderInListMode();
    await screen.findByText('CPU high');
    const typed = 'paused:true cpu label:team=api  folder:folder-1';

    await user.type(searchInput(), `${typed}{Enter}`);

    await waitFor(() =>
      expect(ruleSearchBodies.at(-1)?.where).toEqual({
        and: [
          { text: { value: 'cpu' } },
          { filter: { field: 'folder', operator: 'In', values: ['folder-1'] } },
          { filter: { field: 'labels', operator: 'In', values: ['team=api'] } },
          { filter: { field: 'paused', operator: 'In', values: ['true'] } },
        ],
      })
    );
    expect(ruleSearchBodies).toHaveLength(2);
    expect(searchInput()).toHaveValue(typed);
    expect(searchParam()).toBe(typed);
  });

  it('restores the input and the request from the URL on load', async () => {
    render(<AlertRulesPage />, {
      historyOptions: { initialEntries: ['/?search=folder%3Afolder-1%20label%3Ateam%3D~api.*%20%22high%20load%22'] },
    });

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    expect(searchInput()).toHaveValue('folder:folder-1 label:team=~api.* "high load"');
    expect(ruleSearchBodies.map((body) => body.where)).toEqual([
      {
        and: [
          { text: { value: 'high load' } },
          { filter: { field: 'folder', operator: 'In', values: ['folder-1'] } },
          { regex: { field: 'labels', pattern: 'team=api.*' } },
        ],
      },
    ]);
  });

  it('searches titles for a key:value word the page has no filter for, and keeps it as typed in the URL', async () => {
    const { user } = renderInListMode();
    await screen.findByText('CPU high');

    await user.type(searchInput(), 'foo:bar metric:cpu{Enter}');

    await waitFor(() => expect(ruleSearchBodies.at(-1)?.where).toEqual({ text: { value: 'foo:bar metric:cpu' } }));
    expect(searchParam()).toBe('foo:bar metric:cpu');
    expect(searchInput()).not.toHaveAttribute('aria-invalid');
  });

  it.each([
    ['cpu label:', 'Some filters could not be applied: label'],
    ['state:inactive', 'Use state:normal instead of state:inactive.'],
    ['state:foo', 'Use one of these values for state: firing, pending, recovering, normal'],
    [
      'health:bad label:',
      'Some filters could not be applied: label Use one of these values for health: ok, nodata, error, unknown',
    ],
    ['contactPoint:on-call policy:escalation', 'Some filters could not be applied: contactPoint'],
    ['policy:default paused:false', 'Some filters are not available yet: policy, paused'],
    ['cpu*', 'Search text cannot contain * or %.'],
    ['cpu "high', 'A quote in the search is not closed.'],
  ])('shows why %j cannot be searched, keeps it as typed and sends no request', async (search, message) => {
    render(<AlertRulesPage />, { historyOptions: { initialEntries: [`/?${new URLSearchParams({ search })}`] } });

    expect(await screen.findByText('Change the search to see results')).toBeInTheDocument();
    expect(searchInput()).toHaveValue(search);
    expect(searchInput()).toHaveAttribute('aria-invalid', 'true');
    expect(searchInput()).toHaveAccessibleDescription(message);
    expect(ruleSearchBodies).toEqual([]);
  });

  it('sends no request for an invalid query typed into the input, and searches again once it is fixed', async () => {
    const { user } = renderInListMode();
    await screen.findByText('CPU high');

    await user.type(searchInput(), 'panelId:4{Enter}');

    expect(await screen.findByText('Change the search to see results')).toBeInTheDocument();
    expect(ruleSearchBodies).toHaveLength(1);

    await user.tripleClick(searchInput());
    await user.keyboard('dashboard:dash-1 panelId:4{Enter}');

    await waitFor(() =>
      expect(ruleSearchBodies.at(-1)?.where).toEqual({
        and: [
          { filter: { field: 'dashboardUID', operator: 'In', values: ['dash-1'] } },
          { filter: { field: 'panelID', operator: 'In', values: ['4'] } },
        ],
      })
    );
    expect(await screen.findByText('CPU high')).toBeInTheDocument();
  });

  it.each([
    ['where.and[1].regex.pattern', 'label was rejected: Invalid value: "team=(": missing closing )'],
    ['limit', 'The search was rejected: Invalid value: "team=(": missing closing )'],
  ])('shows a 422 with a cause on %s under the input as %j, with no Retry', async (field, description) => {
    server.use(
      http.post(ruleSearchUrl('alert'), () =>
        HttpResponse.json(
          { code: 422, details: { causes: [{ field, message: 'Invalid value: "team=(": missing closing )' }] } },
          { status: 422 }
        )
      )
    );
    render(<AlertRulesPage />, {
      historyOptions: { initialEntries: [`/?${new URLSearchParams({ search: 'cpu label:team=~(' })}`] },
    });

    expect(await screen.findByText('Change the search to see results')).toBeInTheDocument();
    expect(searchInput()).toHaveAttribute('aria-invalid', 'true');
    expect(searchInput()).toHaveAccessibleDescription(description);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('restarts paging from the first page when a new query is applied', async () => {
    server.use(
      http.post(ruleSearchUrl('alert'), async ({ request }) => {
        const body = (await request.json()) as { where?: unknown; continue?: string };
        ruleSearchBodies.push(body);
        if (body.continue) {
          return secondPage();
        }
        return HttpResponse.json({
          items: [
            ruleItem('alert', body.where ? 'rule-3' : 'rule-1', body.where ? 'Memory high' : 'CPU high', 'folder-1'),
          ],
          metadata: { continue: 'tok' },
        });
      })
    );
    const { user } = renderInListMode();
    await user.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Disk full')).toBeInTheDocument();

    await user.type(searchInput(), 'memory{Enter}');

    expect(await screen.findByText('Memory high')).toBeInTheDocument();
    expect(screen.queryByText('Disk full')).not.toBeInTheDocument();
    expect(screen.queryByText('CPU high')).not.toBeInTheDocument();
    expect(ruleSearchBodies.map((body) => body.continue ?? null)).toEqual([null, 'tok', null]);
  });

  it('clearing the input with the clear button returns to Folders mode', async () => {
    mockFolderSearch(() => ({ items: [folderItem('folder-1', 'Team Alerts')], metadata: {} }));
    mockFolderCounts('alert', { 'folder-1': 1 });
    const { user } = renderInListMode();
    await screen.findByText('CPU high');
    await user.type(searchInput(), 'cpu{Enter}');
    await waitFor(() => expect(ruleSearchBodies.at(-1)?.where).toEqual({ text: { value: 'cpu' } }));

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(await screen.findByRole('button', { name: 'Expand Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeChecked();
    expect(searchParam()).toBe('');
    expect(searchInput()).toHaveValue('');
  });

  it('Back and Forward restore the input and the request for each applied query', async () => {
    const { user } = renderInListMode();
    await screen.findByText('CPU high');
    await user.type(searchInput(), 'cpu{Enter}');
    await waitFor(() => expect(searchParam()).toBe('cpu'));
    // Typing over the selection replaces the query without emptying the input first.
    await user.tripleClick(searchInput());
    await user.keyboard('plugins:hide cpu{Enter}');
    await waitFor(() => expect(searchParam()).toBe('plugins:hide cpu'));

    act(() => locationService.getHistory().goBack());

    await waitFor(() => expect(searchInput()).toHaveValue('cpu'));
    await waitFor(() => expect(ruleSearchBodies.at(-1)?.where).toEqual({ text: { value: 'cpu' } }));

    act(() => locationService.getHistory().goForward());

    await waitFor(() => expect(searchInput()).toHaveValue('plugins:hide cpu'));
    await waitFor(() =>
      expect(ruleSearchBodies.at(-1)?.where).toEqual({
        and: [
          { text: { value: 'cpu' } },
          { regex: { field: 'labels', pattern: '__grafana_origin=plugin/.*', negate: true } },
        ],
      })
    );
  });
});

describe('AlertRulesPage Folders mode', () => {
  let ruleSearchBodies: SearchRequestBody[];
  let intersection: ReturnType<typeof installControllableIntersectionObserver>;

  beforeEach(() => {
    intersection = installControllableIntersectionObserver();
    reportInteractionMock.mockClear();
    mockFolderParents({ 'folder-1': 'Team Alerts', 'folder-2': 'Infra' });
    mockFolderCounts('alert', { 'folder-1': 3, 'folder-2': 0 });
    ruleSearchBodies = [];
    mockRuleSearch('alert', (body) => {
      ruleSearchBodies.push(body);
      return { items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')], metadata: {} };
    });
  });

  afterEach(() => {
    intersection.restore();
  });

  function viewParam() {
    return new URLSearchParams(locationService.getLocation().search).get('view');
  }

  it('opens in Folders mode with collapsed folders in title order, each with its direct Alert-rule count', async () => {
    let body: unknown;
    mockFolderSearch((received) => {
      body = received;
      return { items: [folderItem('folder-2', 'Infra'), folderItem('folder-1', 'Team Alerts')], metadata: {} };
    });

    render(<AlertRulesPage />);

    expect(await screen.findByRole('link', { name: 'Team Alerts' })).toHaveAttribute(
      'href',
      '/dashboards/f/folder-1/team-alerts/alerting'
    );
    const titles = screen.getAllByRole('link').map((link) => link.textContent);
    expect(titles).toEqual(['Infra', 'Team Alerts']);
    expect(await screen.findByText('3 alert rules')).toBeInTheDocument();
    expect(await screen.findByText('0 alert rules')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand Team Alerts' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeChecked();
    expect(body).not.toHaveProperty('where');
    expect(ruleSearchBodies).toEqual([]);
  });

  it('scopes the folder listing to a folder filter and stays in Folders mode', async () => {
    let where: unknown;
    mockFolderSearch((received) => {
      where = received.where;
      return { items: [folderItem('folder-1', 'Team Alerts')], metadata: {} };
    });

    render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?search=folder%3Afolder-1'] } });

    expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeChecked();
    expect(where).toEqual({ filter: { field: 'name', operator: 'In', values: ['folder-1'] } });
    expect(ruleSearchBodies).toEqual([]);
  });

  it('loads only the expanded folder rules, without a folder path on their rows', async () => {
    mockFolderSearch(() => ({
      items: [folderItem('folder-1', 'Team Alerts'), folderItem('folder-2', 'Infra')],
      metadata: {},
    }));
    const { user } = render(<AlertRulesPage />);

    await user.click(await screen.findByRole('button', { name: 'Expand Team Alerts' }));

    const ruleLink = await screen.findByRole('link', { name: 'CPU high' });
    expect(ruleSearchBodies.map((body) => body.where)).toEqual([
      { filter: { field: 'folder', operator: 'In', values: ['folder-1'] } },
    ]);
    // The folder row already names the folder, so the rule row has no path of its own.
    expect(ruleLink.closest('li')).not.toHaveTextContent('Team Alerts');

    await user.click(screen.getByRole('button', { name: 'Collapse Team Alerts' }));

    expect(screen.queryByRole('link', { name: 'CPU high' })).not.toBeInTheDocument();
  });

  it('keeps a separate Load more for each expanded folder', async () => {
    mockFolderSearch(() => ({
      items: [folderItem('folder-1', 'Team Alerts'), folderItem('folder-2', 'Infra')],
      metadata: {},
    }));
    mockRuleSearch('alert', (body) => {
      ruleSearchBodies.push(body);
      if (body.where?.filter?.values?.[0] === 'folder-2') {
        return { items: [ruleItem('alert', 'rule-9', 'Latency', 'folder-2')], metadata: {} };
      }
      return body.continue
        ? { items: [ruleItem('alert', 'rule-2', 'Disk full', 'folder-1')], metadata: {} }
        : { items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')], metadata: { continue: 'tok' } };
    });
    const { user } = render(<AlertRulesPage />);

    await user.click(await screen.findByRole('button', { name: 'Expand Team Alerts' }));
    await user.click(screen.getByRole('button', { name: 'Expand Infra' }));
    expect(await screen.findByText('Latency')).toBeInTheDocument();
    expect(await screen.findByText('CPU high')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load more rules in Team Alerts' }));

    expect(await screen.findByText('Disk full')).toBeInTheDocument();
    expect(screen.getByText('Latency')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Load more/ })).not.toBeInTheDocument();
    expect(ruleSearchBodies.filter((body) => body.continue)).toHaveLength(1);
  });

  it('loads the next page of folders when the end of the list comes into view, keeping the loaded ones, until the last page', async () => {
    const continuations = mockPagedFolderSearch();
    render(<AlertRulesPage />);

    expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(continuations).toEqual([null]);

    intersection.intersectObserved();

    expect(await screen.findByRole('link', { name: 'Infra' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(continuations).toEqual([null, 'tok']);
    expect(screen.queryByTestId('load-more-helper')).not.toBeInTheDocument();
  });

  it('keeps the loaded folders when the next page fails, does not retry on its own, and loads it after Retry', async () => {
    let failNext = true;
    const continuations = mockPagedFolderSearch(() => {
      if (failNext) {
        failNext = false;
        return HttpResponse.json({ message: 'expired' }, { status: 410 });
      }
      return lastFolderPage();
    });
    const { user } = render(<AlertRulesPage />);
    await screen.findByRole('link', { name: 'Team Alerts' });

    intersection.intersectObserved();

    expect(await screen.findByText('Failed to load more results')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(screen.queryByTestId('load-more-helper')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    // The helper is back once the refetch of every loaded page is done.
    expect(await screen.findByTestId('load-more-helper')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load more results')).not.toBeInTheDocument();
    intersection.intersectObserved();
    expect(await screen.findByRole('link', { name: 'Infra' })).toBeInTheDocument();
    expect(continuations).toEqual([null, 'tok', null, 'tok']);
  });

  it('does not watch the end of the list while Retry reloads the loaded pages', async () => {
    let firstPageRequests = 0;
    let releaseReload: () => void = () => {};
    const reloadGate = new Promise<void>((resolve) => {
      releaseReload = resolve;
    });
    server.use(
      http.post(FOLDER_SEARCH_URL, async ({ request }) => {
        const { continue: token } = (await request.json()) as { continue?: string };
        if (token) {
          return HttpResponse.json({ message: 'expired' }, { status: 410 });
        }
        firstPageRequests += 1;
        if (firstPageRequests === 2) {
          await reloadGate;
        }
        return HttpResponse.json({ items: [folderItem('folder-1', 'Team Alerts')], metadata: { continue: 'tok' } });
      })
    );
    const { user } = render(<AlertRulesPage />);
    await screen.findByRole('link', { name: 'Team Alerts' });
    intersection.intersectObserved();
    await user.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(firstPageRequests).toBe(2));

    expect(screen.queryByTestId('load-more-helper')).not.toBeInTheDocument();

    releaseReload();

    expect(await screen.findByTestId('load-more-helper')).toBeInTheDocument();
  });

  it('switches to List for free text, keeps the folder filter, and disables Folders until it is cleared', async () => {
    mockFolderSearch(() => ({ items: [folderItem('folder-1', 'Team Alerts')], metadata: {} }));
    const { user } = render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?search=folder%3Afolder-1'] } });
    await screen.findByRole('link', { name: 'Team Alerts' });

    await user.type(screen.getByRole('textbox', { name: 'Search' }), ' cpu{Enter}');

    expect(await screen.findByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(viewParam()).toBe('list');
    expect(ruleSearchBodies.at(-1)?.where).toEqual({
      and: [{ text: { value: 'cpu' } }, { filter: { field: 'folder', operator: 'In', values: ['folder-1'] } }],
    });
    expect(screen.getByRole('radio', { name: 'List' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeDisabled();
    expect(screen.getByRole('radiogroup', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Folders' })).toHaveAccessibleDescription(
      'Clear filters to browse by folder'
    );

    await user.hover(screen.getByText('Folders'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Clear filters to browse by folder');
  });

  it('switches between Folders and List with the toggle, writing the view to the URL', async () => {
    mockFolderSearch(() => ({ items: [folderItem('folder-1', 'Team Alerts')], metadata: {} }));
    const { user } = render(<AlertRulesPage />);
    await screen.findByRole('link', { name: 'Team Alerts' });

    await user.click(screen.getByRole('radio', { name: 'List' }));

    expect(await screen.findByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(viewParam()).toBe('list');
    expect(ruleSearchBodies.map((body) => body.where)).toEqual([undefined]);

    await user.click(screen.getByRole('radio', { name: 'Folders' }));

    expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(viewParam()).toBeNull();
  });

  it('shows a message for an expanded folder that has no rules', async () => {
    mockFolderSearch(() => ({ items: [folderItem('folder-1', 'Team Alerts')], metadata: {} }));
    mockRuleSearch('alert', () => ({ items: [], metadata: {} }));
    const { user } = render(<AlertRulesPage />);

    await user.click(await screen.findByRole('button', { name: 'Expand Team Alerts' }));

    expect(await screen.findByText('No alert rules in this folder')).toBeInTheDocument();
  });

  it('exposes the loading rules of an expanded folder as a busy list', async () => {
    mockFolderSearch(() => ({ items: [folderItem('folder-1', 'Team Alerts')], metadata: {} }));
    let releasePage: () => void = () => {};
    const pageGate = new Promise<void>((resolve) => {
      releasePage = resolve;
    });
    server.use(
      http.post(ruleSearchUrl('alert'), async () => {
        await pageGate;
        return HttpResponse.json({ items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')], metadata: {} });
      })
    );
    const { user } = render(<AlertRulesPage />);

    await user.click(await screen.findByRole('button', { name: 'Expand Team Alerts' }));

    expect(await screen.findByRole('list', { name: 'Loading rules' })).toHaveAttribute('aria-busy', 'true');
    releasePage();
    expect(await screen.findByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Loading rules' })).not.toBeInTheDocument();
  });

  it('shows a folder title with special characters as typed in its labels', async () => {
    mockFolderSearch(() => ({ items: [folderItem('folder-1', 'R&D <ops>')], metadata: {} }));
    mockRuleSearch('alert', () => ({
      items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')],
      metadata: { continue: 'tok' },
    }));
    const { user } = render(<AlertRulesPage />);

    await user.click(await screen.findByRole('button', { name: 'Expand R&D <ops>' }));

    expect(await screen.findByRole('button', { name: 'Load more rules in R&D <ops>' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse R&D <ops>' })).toBeInTheDocument();
  });

  it('shows an expanded folder rule search failure with Retry, and the rules after Retry', async () => {
    mockFolderSearch(() => ({ items: [folderItem('folder-1', 'Team Alerts')], metadata: {} }));
    failFirstCall('post', ruleSearchUrl('alert'), {
      items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')],
      metadata: {},
    });
    const { user } = render(<AlertRulesPage />);

    await user.click(await screen.findByRole('button', { name: 'Expand Team Alerts' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load rules');

    await user.click(screen.getByRole('button', { name: 'Retry loading rules in Team Alerts' }));

    expect(await screen.findByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.queryByText('Failed to load rules')).not.toBeInTheDocument();
  });

  it('keeps an expanded folder open, with its rules and no new rule search, when the folder list loads its next page', async () => {
    mockPagedFolderSearch();
    const { user } = render(<AlertRulesPage />);
    await user.click(await screen.findByRole('button', { name: 'Expand Team Alerts' }));
    const ruleLink = await screen.findByRole('link', { name: 'CPU high' });
    expect(ruleSearchBodies).toHaveLength(1);

    intersection.intersectObserved();

    expect(await screen.findByRole('link', { name: 'Infra' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse Team Alerts' })).toHaveAttribute('aria-expanded', 'true');
    // The same node, so the folder was not remounted and its rules were not fetched again.
    expect(ruleLink).toBeInTheDocument();
    expect(ruleSearchBodies).toHaveLength(1);
  });

  it('restarts the folder list from the first page, collapsed, when the folder filter changes', async () => {
    const continuations = mockPagedFolderSearch();
    const { user } = render(<AlertRulesPage />, { historyOptions: { initialEntries: ['/?search=folder%3Afolder-1'] } });
    await user.click(await screen.findByRole('button', { name: 'Expand Team Alerts' }));
    await screen.findByRole('link', { name: 'CPU high' });
    intersection.intersectObserved();
    expect(await screen.findByRole('link', { name: 'Infra' })).toBeInTheDocument();

    await user.tripleClick(screen.getByRole('textbox', { name: 'Search' }));
    await user.keyboard('folder:folder-2{Enter}');

    await waitFor(() => expect(continuations).toEqual([null, 'tok', null]));
    // The same folder reappears under the new filter, but no longer expanded.
    expect(await screen.findByRole('button', { name: 'Expand Team Alerts' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Infra' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'CPU high' })).not.toBeInTheDocument();
  });

  it('Back and Forward restore Folders and List as the view changes', async () => {
    mockFolderSearch(() => ({ items: [folderItem('folder-1', 'Team Alerts')], metadata: {} }));
    const { user } = render(<AlertRulesPage />);
    await screen.findByRole('link', { name: 'Team Alerts' });
    await user.click(screen.getByRole('radio', { name: 'List' }));
    await screen.findByRole('link', { name: 'CPU high' });

    act(() => locationService.getHistory().goBack());

    expect(await screen.findByRole('button', { name: 'Expand Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Folders' })).toBeChecked();
    expect(viewParam()).toBeNull();

    act(() => locationService.getHistory().goForward());

    expect(await screen.findByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'List' })).toBeChecked();
    expect(viewParam()).toBe('list');
  });

  it('shows loading rows and no end-of-list helper while the next page of folders loads', async () => {
    let releasePage: () => void = () => {};
    const pageGate = new Promise<void>((resolve) => {
      releasePage = resolve;
    });
    mockPagedFolderSearch(async () => {
      await pageGate;
      return HttpResponse.json({ items: [folderItem('folder-2', 'Infra')], metadata: { continue: 'tok-2' } });
    });
    render(<AlertRulesPage />);
    await screen.findByRole('link', { name: 'Team Alerts' });

    intersection.intersectObserved();

    expect(await screen.findByRole('list', { name: 'Loading rules' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('load-more-helper')).not.toBeInTheDocument();

    releasePage();

    expect(await screen.findByRole('link', { name: 'Infra' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Loading rules' })).not.toBeInTheDocument();
    expect(screen.getByTestId('load-more-helper')).toBeInTheDocument();
  });
});
