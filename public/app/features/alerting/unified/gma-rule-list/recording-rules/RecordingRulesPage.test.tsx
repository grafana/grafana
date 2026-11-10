import { HttpResponse, http } from 'msw';
import { render, screen, userEvent, waitFor } from 'test/test-utils';

import { locationService, reportInteraction } from '@grafana/runtime';
import server from '@grafana/test-utils/server';

import { setupMswServer } from '../../mockApi';
import { folderFactory, folderItem, recordingRuleFactory, ruleItem } from '../mocks/factories';
import { FOLDER_SEARCH_URL, failFirstCall, mockFolderParents, mockRuleSearch, ruleSearchUrl } from '../mocks/handlers';
import { type RuleListBackend, setupRuleListBackend } from '../mocks/ruleListBackend';

import RecordingRulesPage from './RecordingRulesPage';

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

/** Folders is the default view; List tests open the page with `view=list`. */
function renderInListMode() {
  return render(<RecordingRulesPage />, { historyOptions: { initialEntries: ['/?view=list'] } });
}

describe('RecordingRulesPage', () => {
  beforeEach(() => {
    reportInteractionMock.mockClear();
    mockFolderParents({ 'folder-1': 'Team Metrics', 'folder-2': 'Infra' });
  });

  it('lists the Recording rules in the order the search returns them, each with its folder path', async () => {
    mockRuleSearch('recording', () => ({
      items: [
        ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1'),
        ruleItem('recording', 'rule-2', 'disk:usage:rate5m', 'folder-2'),
      ],
      metadata: {},
    }));

    renderInListMode();

    const rows = await screen.findAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('a')?.textContent)).toEqual(['cpu:usage:rate5m', 'disk:usage:rate5m']);
    expect(await screen.findByText('Team Metrics')).toBeInTheDocument();
    expect(await screen.findByText('Infra')).toBeInTheDocument();
  });

  it('asks searchRecordingRules for 40 rules sorted by title, with no filter', async () => {
    let body: unknown;
    mockRuleSearch('recording', (received) => {
      body = received;
      return { items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')], metadata: {} };
    });

    renderInListMode();

    expect(await screen.findByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(body).toMatchObject({ kind: 'SearchQuery', sort: [{ field: 'title', direction: 'asc' }], limit: 40 });
    expect(body).not.toHaveProperty('where');
  });

  it("shows the first page's total as the result count", async () => {
    mockRuleSearch('recording', () => ({
      items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
      metadata: { totalHits: 42, totalHitsRelation: 'eq' },
    }));

    renderInListMode();

    expect(await screen.findByText('42 recording rules')).toBeInTheDocument();
  });

  it('shows skeleton rows in a busy list until the first page arrives', async () => {
    let releasePage: () => void = () => {};
    const pageGate = new Promise<void>((resolve) => {
      releasePage = resolve;
    });
    server.use(
      http.post(ruleSearchUrl('recording'), async () => {
        await pageGate;
        return HttpResponse.json({
          items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
          metadata: {},
        });
      })
    );

    renderInListMode();

    expect(await screen.findByRole('list', { name: 'Loading rules' })).toHaveAttribute('aria-busy', 'true');
    releasePage();
    expect(await screen.findByRole('link', { name: 'cpu:usage:rate5m' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Loading rules' })).not.toBeInTheDocument();
  });

  it('shows the empty state after a successful empty response', async () => {
    mockRuleSearch('recording', () => ({ items: [], metadata: {} }));

    renderInListMode();

    expect(await screen.findByText('No recording rules found')).toBeInTheDocument();
  });

  it('shows a retryable error instead of the empty state when the first page fails', async () => {
    const callCount = failFirstCall(ruleSearchUrl('recording'), {
      items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
      metadata: {},
    });

    renderInListMode();

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load recording rules');
    expect(screen.queryByText('No recording rules found')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(callCount()).toBe(2);
  });

  it('keeps loaded rows when Load more fails, and reloads them with fresh tokens on Retry', async () => {
    const continuations: Array<string | null> = [];
    let firstPages = 0;
    let failNext = true;
    server.use(
      http.post(ruleSearchUrl('recording'), async ({ request }) => {
        const { continue: token } = (await request.json()) as { continue?: string };
        continuations.push(token ?? null);
        if (!token) {
          firstPages += 1;
          return HttpResponse.json({
            items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
            // The reloaded first page hands out a new token, so a replayed one is detectable.
            metadata: { continue: firstPages === 1 ? 'tok' : 'tok-fresh' },
          });
        }
        if (token === 'tok' || token === 'tok-fresh') {
          return HttpResponse.json({
            items: [ruleItem('recording', 'rule-2', 'disk:usage:rate5m', 'folder-2')],
            metadata: { continue: 'tok-2' },
          });
        }
        if (failNext) {
          failNext = false;
          return HttpResponse.json({ message: 'expired' }, { status: 410 });
        }
        return HttpResponse.json({
          items: [ruleItem('recording', 'rule-3', 'mem:usage:rate5m', 'folder-1')],
          metadata: {},
        });
      })
    );

    renderInListMode();

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    await screen.findByText('disk:usage:rate5m');
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Failed to load more results')).toBeInTheDocument();
    expect(screen.getByText('cpu:usage:rate5m')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    // Retry reloads both loaded pages from the first one, taking the second page's token from the reloaded first page.
    await waitFor(() => expect(continuations).toEqual([null, 'tok', 'tok-2', null, 'tok-fresh']));
    expect(await screen.findByRole('button', { name: 'Load more' })).toBeEnabled();
    expect(screen.getByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(screen.getByText('disk:usage:rate5m')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('mem:usage:rate5m')).toBeInTheDocument();
  });

  it('keeps loaded rows and names the refresh as failed when the reload on Retry fails too', async () => {
    let calls = 0;
    server.use(
      http.post(ruleSearchUrl('recording'), () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({
            items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
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
    expect(screen.getByText('cpu:usage:rate5m')).toBeInTheDocument();
  });

  it.each([
    {
      mode: 'list',
      mockEmpty: () => mockRuleSearch('recording', () => ({ items: [], metadata: {} })),
      renderPage: renderInListMode,
    },
    {
      mode: 'folders',
      mockEmpty: () => setupRuleListBackend({ folders: [] }),
      renderPage: () => render(<RecordingRulesPage />),
    },
  ])(
    'reports one page view in $mode mode per mount, not again on re-render',
    async ({ mode, mockEmpty, renderPage }) => {
      mockEmpty();
      const pageViewCalls = () =>
        reportInteractionMock.mock.calls.filter(([event]) => event === 'grafana_alerting_gma_rule_list_view');

      const { rerender } = renderPage();
      await screen.findByText('No recording rules found');
      expect(pageViewCalls()).toEqual([['grafana_alerting_gma_rule_list_view', { kind: 'recording', mode }]]);

      rerender(<RecordingRulesPage />);
      await screen.findByText('No recording rules found');

      expect(pageViewCalls()).toHaveLength(1);
    }
  );
});

describe('RecordingRulesPage search', () => {
  let ruleSearchBodies: Array<{ where?: unknown; continue?: string }>;

  function searchParam() {
    return new URLSearchParams(locationService.getLocation().search).get('search');
  }

  function searchInput() {
    return screen.getByRole('textbox', { name: 'Search' });
  }

  beforeEach(() => {
    mockFolderParents({ 'folder-1': 'Team Metrics' });
    server.use(
      http.post(FOLDER_SEARCH_URL, () =>
        HttpResponse.json({ items: [folderItem('folder-1', 'Team Metrics')], metadata: {} })
      )
    );
    ruleSearchBodies = [];
    mockRuleSearch('recording', (body) => {
      ruleSearchBodies.push(body);
      return { items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')], metadata: {} };
    });
  });

  it('keeps a multi-token query exactly as typed in the input and the URL, and sends it as one request', async () => {
    const { user } = renderInListMode();
    await screen.findByText('cpu:usage:rate5m');
    const typed = 'health:ok cpu targetDatasource:prom-1  metric:cpu_usage';

    await user.type(searchInput(), `${typed}{Enter}`);

    await waitFor(() =>
      expect(ruleSearchBodies.at(-1)?.where).toEqual({
        and: [
          { text: { value: 'cpu' } },
          { filter: { field: 'metric', operator: 'In', values: ['cpu_usage'] } },
          { filter: { field: 'targetDatasourceUID', operator: 'In', values: ['prom-1'] } },
          { filter: { field: 'health', operator: 'In', values: ['Recording'] } },
        ],
      })
    );
    expect(ruleSearchBodies).toHaveLength(2);
    expect(searchInput()).toHaveValue(typed);
    expect(searchParam()).toBe(typed);
  });

  it('restores the input and the request from the URL on load', async () => {
    render(<RecordingRulesPage />, {
      historyOptions: { initialEntries: ['/?search=folder%3A%22Team%20Metrics%22%20metric%3Acpu_usage'] },
    });

    expect(await screen.findByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(searchInput()).toHaveValue('folder:"Team Metrics" metric:cpu_usage');
    expect(ruleSearchBodies.map((body) => body.where)).toEqual([
      {
        and: [
          { filter: { field: 'folder', operator: 'In', values: ['folder-1'] } },
          { filter: { field: 'metric', operator: 'In', values: ['cpu_usage'] } },
        ],
      },
    ]);
  });

  it('searches titles for state:, which only Alert rules have, and keeps it as typed in the URL', async () => {
    const { user } = renderInListMode();
    await screen.findByText('cpu:usage:rate5m');

    await user.type(searchInput(), 'state:firing{Enter}');

    await waitFor(() => expect(ruleSearchBodies.at(-1)?.where).toEqual({ text: { value: 'state:firing' } }));
    expect(searchParam()).toBe('state:firing');
    expect(searchInput()).not.toHaveAttribute('aria-invalid');
  });

  it.each([
    ['cpu metric:', 'Some filters could not be applied: metric'],
    ['health:bad', 'Use one of these values for health: ok, nodata, error, unknown'],
  ])('shows why %j cannot be searched, keeps it as typed and sends no request', async (search, message) => {
    render(<RecordingRulesPage />, { historyOptions: { initialEntries: [`/?${new URLSearchParams({ search })}`] } });

    expect(await screen.findByText('Change the search to see results')).toBeInTheDocument();
    expect(searchInput()).toHaveValue(search);
    expect(searchInput()).toHaveAttribute('aria-invalid', 'true');
    expect(searchInput()).toHaveAccessibleDescription(message);
    expect(ruleSearchBodies).toEqual([]);
  });

  it.each<[search: string, field: string, message: string, description: string]>([
    [
      'cpu label:team=~(',
      'where.and[1].regex.pattern',
      'Invalid value: "team=(": missing closing )',
      'label was rejected: Invalid value: "team=(": missing closing )',
    ],
    [
      'cpu metric:a+b',
      'where.and[1].filter.values',
      'Invalid value: "a+b": not a metric name',
      'metric was rejected: Invalid value: "a+b": not a metric name',
    ],
  ])('shows a 422 for %j on %s under the input, with no Retry', async (search, field, message, description) => {
    server.use(
      http.post(ruleSearchUrl('recording'), () =>
        HttpResponse.json({ code: 422, details: { causes: [{ field, message }] } }, { status: 422 })
      )
    );
    render(<RecordingRulesPage />, { historyOptions: { initialEntries: [`/?${new URLSearchParams({ search })}`] } });

    expect(await screen.findByText('Change the search to see results')).toBeInTheDocument();
    expect(searchInput()).toHaveAttribute('aria-invalid', 'true');
    expect(searchInput()).toHaveAccessibleDescription(description);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});

describe('RecordingRulesPage folder names', () => {
  let backend: RuleListBackend;

  beforeEach(() => {
    backend = setupRuleListBackend({
      folders: [
        folderFactory.build({ metadata: { name: 'db-metrics' }, spec: { title: 'Metrics' } }),
        folderFactory.build({ metadata: { name: 'k8s-metrics' }, spec: { title: 'Metrics' } }),
      ],
      recordingRules: [
        recordingRuleFactory.inFolder('db-metrics').build({ spec: { title: 'db:queries:rate5m' } }),
        recordingRuleFactory.inFolder('k8s-metrics').build({ spec: { title: 'pod:restarts:rate5m' } }),
      ],
    });
  });

  function renderWithSearch(search: string) {
    return render(<RecordingRulesPage />, {
      historyOptions: { initialEntries: [`/?${new URLSearchParams({ search, view: 'list' })}`] },
    });
  }

  it('lists the rules of every folder with that name, whatever its case', async () => {
    renderWithSearch('folder:metrics');

    expect(await screen.findByText('db:queries:rate5m')).toBeInTheDocument();
    expect(screen.getByText('pod:restarts:rate5m')).toBeInTheDocument();
    expect(backend.folderSearches).toEqual([
      expect.objectContaining({
        labelSelector: { matchLabels: { 'alerting.grafana.app/has-recording-rules': 'true' } },
      }),
    ]);
    expect(backend.ruleSearches.map((body) => body.where)).toEqual([
      { filter: { field: 'folder', operator: 'In', values: ['db-metrics', 'k8s-metrics'] } },
    ]);
  });

  it.each([
    { folderCount: 500, empty: false, limited: false },
    { folderCount: 501, empty: false, limited: true },
    { folderCount: 501, empty: true, limited: true },
  ])(
    'warns only when folders are omitted ($folderCount folders, empty: $empty)',
    async ({ folderCount, empty, limited }) => {
      const folders = Array.from({ length: folderCount }, (_, index) =>
        folderFactory.build({ metadata: { name: `folder-${index}` }, spec: { title: 'Shared' } })
      );
      backend = setupRuleListBackend({
        folders,
        recordingRules: folders.map((folder) =>
          recordingRuleFactory
            .inFolder(folder.metadata.name!)
            .build({ spec: { title: `Rule in ${folder.metadata.name}` } })
        ),
      });
      renderWithSearch(`folder:Shared${empty ? ' label:team=missing' : ''}`);

      expect(await screen.findByText(empty ? 'No recording rules found' : 'Rule in folder-0')).toBeInTheDocument();
      if (limited) {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Showing results from only the first 500 matching folders. Narrow your search criteria to see results from other folders.'
        );
      } else {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      }
    }
  );

  it('shows the empty state and sends no rule search when no folder has that name', async () => {
    renderWithSearch('folder:Metric');

    expect(await screen.findByText('No recording rules match this folder')).toBeInTheDocument();
    expect(backend.ruleSearches).toEqual([]);
  });

  it('shows a failed folder lookup as a failed load with Retry, and lists the rules after a successful retry', async () => {
    backend.failNext('folderSearch');
    const { user } = renderWithSearch('folder:Metrics');

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load recording rules');
    expect(backend.ruleSearches).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('db:queries:rate5m')).toBeInTheDocument();
  });
});
