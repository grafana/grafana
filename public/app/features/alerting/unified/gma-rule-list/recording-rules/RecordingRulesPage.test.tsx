import { HttpResponse, http } from 'msw';
import { render, screen, userEvent, waitFor } from 'test/test-utils';

import { reportInteraction } from '@grafana/runtime';
import server from '@grafana/test-utils/server';

import { setupMswServer } from '../../mockApi';
import { ruleItem } from '../mocks/factories';
import { mockFolderParents, mockRuleSearch, ruleSearchUrl } from '../mocks/handlers';

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

/** Serves the first page with a continuation token; `nextPage` answers every request that carries one. */
function mockPagedSearch(nextPage: (token: string) => Response | Promise<Response>) {
  const continuations: Array<string | null> = [];
  server.use(
    http.post(ruleSearchUrl('recording'), async ({ request }) => {
      const { continue: token } = (await request.json()) as { continue?: string };
      continuations.push(token ?? null);
      if (!token) {
        return HttpResponse.json({
          items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
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
  return HttpResponse.json({
    items: [ruleItem('recording', 'rule-2', 'disk:usage:rate5m', 'folder-2')],
    metadata: {},
  });
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

    render(<RecordingRulesPage />);

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

    render(<RecordingRulesPage />);

    expect(await screen.findByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(body).toMatchObject({ kind: 'SearchQuery', sort: [{ field: 'title', direction: 'asc' }], limit: 40 });
    expect(body).not.toHaveProperty('where');
  });

  it("shows the first page's total as the result count", async () => {
    mockRuleSearch('recording', () => ({
      items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
      metadata: { totalHits: 42, totalHitsRelation: 'eq' },
    }));

    render(<RecordingRulesPage />);

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

    render(<RecordingRulesPage />);

    expect(await screen.findByRole('list', { name: 'Loading rules' })).toHaveAttribute('aria-busy', 'true');
    releasePage();
    expect(await screen.findByRole('link', { name: 'cpu:usage:rate5m' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Loading rules' })).not.toBeInTheDocument();
  });

  it('shows the empty state after a successful empty response', async () => {
    mockRuleSearch('recording', () => ({ items: [], metadata: {} }));

    render(<RecordingRulesPage />);

    expect(await screen.findByText('No recording rules found')).toBeInTheDocument();
  });

  it('shows a retryable error instead of the empty state when the first page fails', async () => {
    const callCount = failFirstCall(ruleSearchUrl('recording'), {
      items: [ruleItem('recording', 'rule-1', 'cpu:usage:rate5m', 'folder-1')],
      metadata: {},
    });

    render(<RecordingRulesPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load rules');
    expect(screen.queryByText('No recording rules found')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(callCount()).toBe(2);
  });

  it('keeps loaded rows visible when Load more fails and repeats the same continuation request on Retry', async () => {
    let failNext = true;
    const continuations = mockPagedSearch(() => {
      if (failNext) {
        failNext = false;
        return HttpResponse.json({ message: 'boom' }, { status: 500 });
      }
      return secondPage();
    });

    render(<RecordingRulesPage />);

    expect(await screen.findByText('cpu:usage:rate5m')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Failed to load more results')).toBeInTheDocument();
    expect(screen.getByText('cpu:usage:rate5m')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('disk:usage:rate5m')).toBeInTheDocument();
    expect(screen.getByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(continuations).toEqual([null, 'tok', 'tok']);
  });

  it('restarts from the first page on Retry when the server rejected the continuation token', async () => {
    let rejectNext = true;
    const continuations = mockPagedSearch((token) => {
      if (token === 'tok') {
        return HttpResponse.json({
          items: [ruleItem('recording', 'rule-2', 'disk:usage:rate5m', 'folder-2')],
          metadata: { continue: 'tok-2' },
        });
      }
      if (rejectNext) {
        rejectNext = false;
        return HttpResponse.json({ message: 'expired' }, { status: 410 });
      }
      return HttpResponse.json({
        items: [ruleItem('recording', 'rule-3', 'mem:usage:rate5m', 'folder-1')],
        metadata: {},
      });
    });

    render(<RecordingRulesPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    await screen.findByText('disk:usage:rate5m');
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Failed to load more results')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    // Only the first page is fetched again; the pages after it were built on the rejected chain.
    await waitFor(() => expect(screen.queryByText('disk:usage:rate5m')).not.toBeInTheDocument());
    expect(screen.getByText('cpu:usage:rate5m')).toBeInTheDocument();
    expect(continuations).toEqual([null, 'tok', 'tok-2', null]);
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

    render(<RecordingRulesPage />);

    await screen.findByText('cpu:usage:rate5m');
    await userEvent.dblClick(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Load more' })).toBeDisabled());
    releasePage();

    expect(await screen.findByText('disk:usage:rate5m')).toBeInTheDocument();
    expect(continuations).toEqual([null, 'tok']);
  });

  it('reports one page view in List mode per mount, not again on re-render', async () => {
    mockRuleSearch('recording', () => ({ items: [], metadata: {} }));
    const pageViewCalls = () =>
      reportInteractionMock.mock.calls.filter(([event]) => event === 'grafana_alerting_gma_rule_list_view');

    const { rerender } = render(<RecordingRulesPage />);
    await screen.findByText('No recording rules found');
    expect(pageViewCalls()).toEqual([['grafana_alerting_gma_rule_list_view', { kind: 'recording', mode: 'list' }]]);

    rerender(<RecordingRulesPage />);
    await screen.findByText('No recording rules found');

    expect(pageViewCalls()).toHaveLength(1);
  });
});
