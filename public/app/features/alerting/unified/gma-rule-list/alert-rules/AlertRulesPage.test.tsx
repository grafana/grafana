import { HttpResponse, http } from 'msw';
import { render, screen, userEvent, waitFor } from 'test/test-utils';

import { reportInteraction } from '@grafana/runtime';
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
