import { HttpResponse, http } from 'msw';
import { act, render, screen, userEvent, waitFor } from 'test/test-utils';

import { locationService, reportInteraction } from '@grafana/runtime';
import server from '@grafana/test-utils/server';

import { setupMswServer } from '../../mockApi';
import { ruleItem } from '../mocks/factories';
import { mockFolderParents, mockRuleSearch, ruleSearchUrl } from '../mocks/handlers';

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

/** Serves the first page with a continuation token; `nextPage` answers every request that carries one. */
function mockPagedSearch(nextPage: (token: string) => Response | Promise<Response>) {
  const continuations: Array<string | null> = [];
  server.use(
    http.post(ruleSearchUrl('alert'), async ({ request }) => {
      const { continue: token } = (await request.json()) as { continue?: string };
      continuations.push(token ?? null);
      if (!token) {
        return HttpResponse.json({
          items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')],
          metadata: { continue: 'tok' },
        });
      }
      return nextPage(token);
    })
  );
  return continuations;
}

/** Fails the first POST to `url` with a 500, then answers with `ok`; returns a request counter. */
function failFirstCall(url: string, ok: object) {
  let calls = 0;
  server.use(
    http.post(url, () => {
      calls += 1;
      return calls === 1 ? HttpResponse.json({ message: 'boom' }, { status: 500 }) : HttpResponse.json(ok);
    })
  );
  return () => calls;
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

    render(<AlertRulesPage />);

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

    render(<AlertRulesPage />);

    expect(await screen.findByText('CPU high')).toBeInTheDocument();
    expect(body).toMatchObject({ kind: 'SearchQuery', sort: [{ field: 'title', direction: 'asc' }], limit: 40 });
    expect(body).not.toHaveProperty('where');
  });

  it("shows the first page's total as the result count", async () => {
    mockRuleSearch('alert', () => ({
      items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')],
      metadata: { totalHits: 154, totalHitsRelation: 'eq' },
    }));

    render(<AlertRulesPage />);

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

    render(<AlertRulesPage />);

    expect(await screen.findByRole('list', { name: 'Loading rules' })).toHaveAttribute('aria-busy', 'true');
    releasePage();
    expect(await screen.findByRole('link', { name: 'CPU high' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Loading rules' })).not.toBeInTheDocument();
  });

  it('shows the empty state after a successful empty response', async () => {
    mockRuleSearch('alert', () => ({ items: [], metadata: {} }));

    render(<AlertRulesPage />);

    expect(await screen.findByText('No alert rules found')).toBeInTheDocument();
  });

  it('shows a retryable error instead of the empty state when the first page fails', async () => {
    const callCount = failFirstCall(ruleSearchUrl('alert'), {
      items: [ruleItem('alert', 'rule-1', 'CPU high', 'folder-1')],
      metadata: {},
    });

    render(<AlertRulesPage />);

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

    render(<AlertRulesPage />);

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

    render(<AlertRulesPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Failed to refresh results')).toBeInTheDocument();
    expect(screen.getByText('CPU high')).toBeInTheDocument();
  });

  it('loads one page once when Load more is double clicked', async () => {
    let releasePage: () => void = () => {};
    const pageGate = new Promise<void>((resolve) => {
      releasePage = resolve;
    });
    const continuations = mockPagedSearch(async () => {
      await pageGate;
      return secondPage();
    });

    render(<AlertRulesPage />);

    await screen.findByText('CPU high');
    await userEvent.dblClick(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load more' })).toBeDisabled());
    releasePage();

    expect(await screen.findByText('Disk full')).toBeInTheDocument();
    expect(continuations).toEqual([null, 'tok']);
  });

  it('reports one page view in List mode per mount, not again on re-render', async () => {
    mockRuleSearch('alert', () => ({ items: [], metadata: {} }));
    const pageViewCalls = () =>
      reportInteractionMock.mock.calls.filter(([event]) => event === 'grafana_alerting_gma_rule_list_view');

    const { rerender } = render(<AlertRulesPage />);
    await screen.findByText('No alert rules found');
    expect(pageViewCalls()).toEqual([['grafana_alerting_gma_rule_list_view', { kind: 'alert', mode: 'list' }]]);

    rerender(<AlertRulesPage />);
    await screen.findByText('No alert rules found');

    expect(pageViewCalls()).toHaveLength(1);
  });
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
    const { user } = render(<AlertRulesPage />);
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
    const { user } = render(<AlertRulesPage />);
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
    const { user } = render(<AlertRulesPage />);
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
    const { user } = render(<AlertRulesPage />);
    await user.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Disk full')).toBeInTheDocument();

    await user.type(searchInput(), 'memory{Enter}');

    expect(await screen.findByText('Memory high')).toBeInTheDocument();
    expect(screen.queryByText('Disk full')).not.toBeInTheDocument();
    expect(screen.queryByText('CPU high')).not.toBeInTheDocument();
    expect(ruleSearchBodies.map((body) => body.continue ?? null)).toEqual([null, 'tok', null]);
  });

  it('clearing the input with the clear button searches again without a filter', async () => {
    const { user } = render(<AlertRulesPage />);
    await screen.findByText('CPU high');
    await user.type(searchInput(), 'cpu{Enter}');
    await waitFor(() => expect(ruleSearchBodies.at(-1)?.where).toEqual({ text: { value: 'cpu' } }));

    const requestsBeforeClear = ruleSearchBodies.length;

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => expect(ruleSearchBodies).toHaveLength(requestsBeforeClear + 1));
    expect(ruleSearchBodies.at(-1)?.where).toBeUndefined();
    expect(searchParam()).toBe('');
    expect(searchInput()).toHaveValue('');
  });

  it('Back and Forward restore the input and the request for each applied query', async () => {
    const { user } = render(<AlertRulesPage />);
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
