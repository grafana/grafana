import { HttpResponse, http } from 'msw';
import { render, screen, waitFor, within } from 'test/test-utils';

import { getAPIBaseURL } from '@grafana/api-clients';
import { type AlertRule, type AlertRuleList } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { reportInteraction, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { FOLDER_PARENTS_URL, rulesUrl } from '../../mocks/handlers';

import { AlertRulesRecentlyDeleted } from './AlertRulesRecentlyDeleted';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const reportInteractionMock = jest.mocked(reportInteraction);

const ALERT_RULES_URL = rulesUrl('alert');
const DISPLAY_MAPPING_URL = `${getAPIBaseURL('iam.grafana.app', 'v0alpha1')}/display`;

function buildAlertRule(overrides: Partial<AlertRule> = {}, specOverrides: Partial<AlertRule['spec']> = {}): AlertRule {
  return {
    apiVersion: 'v0alpha1',
    kind: 'AlertRule',
    metadata: {
      name: 'rule-uid-1',
      annotations: {
        'grafana.app/folder': 'folder-uid-1',
        'grafana.app/updatedBy': 'user:1',
      },
      deletionTimestamp: '2024-05-01T00:00:00Z',
    },
    spec: {
      title: 'High CPU usage',
      execErrState: 'Alerting',
      noDataState: 'NoData',
      trigger: { interval: '1m' },
      expressions: {},
      ...specOverrides,
    },
    ...overrides,
  };
}

function mockAlertRulesResponse(response: AlertRuleList, requestAssertions?: (url: URL) => void) {
  server.use(
    http.get(ALERT_RULES_URL, ({ request }) => {
      requestAssertions?.(new URL(request.url));
      return HttpResponse.json(response);
    })
  );
}

function mockFolderAndUserLookups() {
  server.use(
    http.get(FOLDER_PARENTS_URL, ({ params }) => {
      return HttpResponse.json({
        items: [{ name: String(params.name), title: 'Production' }],
      });
    }),
    http.get(DISPLAY_MAPPING_URL, ({ request }) => {
      const keys = new URL(request.url).searchParams.getAll('key');
      return HttpResponse.json({
        keys,
        display: keys.map((key) => ({ identity: { type: 'user', name: key }, displayName: `Display of ${key}` })),
      });
    })
  );
}

setBackendSrv(backendSrv);
setupMockServer();

describe('AlertRulesRecentlyDeleted', () => {
  beforeEach(() => {
    reportInteractionMock.mockClear();
    mockFolderAndUserLookups();
  });

  it('requests only the AlertRule trash selector, with no title/folder/user filter or Refresh controls', async () => {
    let requestedSelector: string | null = null;
    mockAlertRulesResponse({ items: [buildAlertRule()], metadata: {} }, (url) => {
      requestedSelector = url.searchParams.get('labelSelector');
    });

    render(<AlertRulesRecentlyDeleted />);

    await screen.findByText('High CPU usage');

    expect(requestedSelector).toBe('grafana.app/get-trash=true');
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /filter/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
  });

  it('reveals more than 40 rows from an oversized response in a 40-row chunk via Load more, without duplicate requests', async () => {
    let requestCount = 0;
    const rules = Array.from({ length: 65 }, (_, i) =>
      buildAlertRule({ metadata: { name: `rule-${i}` } }, { title: `Rule ${i}` })
    );
    mockAlertRulesResponse({ items: rules, metadata: {} }, () => {
      requestCount += 1;
    });

    const { user } = render(<AlertRulesRecentlyDeleted />);

    await screen.findByText('Rule 0');
    expect(screen.queryByText('Rule 40')).not.toBeInTheDocument();
    expect(requestCount).toBe(1);

    await user.click(screen.getByRole('button', { name: /load more/i }));

    await screen.findByText('Rule 40');
    expect(screen.getByText('Rule 64')).toBeInTheDocument();
    // Served from the local buffer, no second request.
    expect(requestCount).toBe(1);
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('follows a metadata.continue token via Load more', async () => {
    const requestedTokens: Array<string | null> = [];
    server.use(
      http.get(ALERT_RULES_URL, ({ request }) => {
        const url = new URL(request.url);
        const continueToken = url.searchParams.get('continue');
        requestedTokens.push(continueToken);
        if (!continueToken) {
          return HttpResponse.json({
            items: [buildAlertRule({ metadata: { name: 'rule-page1' } }, { title: 'Page 1 rule' })],
            metadata: { continue: 'next-page-token' },
          });
        }
        return HttpResponse.json({
          items: [buildAlertRule({ metadata: { name: 'rule-page2' } }, { title: 'Page 2 rule' })],
          metadata: {},
        });
      })
    );

    const { user } = render(<AlertRulesRecentlyDeleted />);

    await screen.findByText('Page 1 rule');
    await user.click(screen.getByRole('button', { name: /load more/i }));

    await screen.findByText('Page 2 rule');
    expect(requestedTokens).toEqual([null, 'next-page-token']);
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('shows title, resolved folder path, deletion time, and resolved deleting user, and opens Review', async () => {
    mockAlertRulesResponse({ items: [buildAlertRule()], metadata: {} });

    const { user } = render(<AlertRulesRecentlyDeleted />);

    await screen.findByText('High CPU usage');
    await screen.findByText('Production');
    await screen.findByText(/Display of user:1/);
    // Re-query: the click could otherwise hit a node replaced after the async lookups settle.
    const row = screen.getByText('High CPU usage').closest('tr');
    expect(row).not.toBeNull();

    await user.click(within(row!).getByRole('button', { name: /review/i }));

    expect(await screen.findByText('Deleted alert rule')).toBeInTheDocument();
    expect(screen.getAllByText('High CPU usage').length).toBeGreaterThan(0);
  });

  it('shows the empty state only after a successful empty response', async () => {
    mockAlertRulesResponse({ items: [], metadata: {} });

    render(<AlertRulesRecentlyDeleted />);

    expect(await screen.findByText(/no recently deleted rules found/i)).toBeInTheDocument();
  });

  it('falls back to the folder UID when the folder lookup fails, without disabling the row', async () => {
    mockAlertRulesResponse({ items: [buildAlertRule()], metadata: {} });
    server.use(http.get(FOLDER_PARENTS_URL, () => HttpResponse.json({ message: 'not found' }, { status: 404 })));

    render(<AlertRulesRecentlyDeleted />);

    const row = (await screen.findByText('High CPU usage')).closest('tr');
    await waitFor(() => expect(within(row!).getByText('folder-uid-1')).toBeInTheDocument());
    expect(within(row!).getByRole('button', { name: /review/i })).toBeEnabled();
  });

  it('falls back to the updatedBy UID when the user-display lookup fails, without disabling the row', async () => {
    mockAlertRulesResponse({ items: [buildAlertRule()], metadata: {} });
    server.use(http.get(DISPLAY_MAPPING_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

    render(<AlertRulesRecentlyDeleted />);

    const row = (await screen.findByText('High CPU usage')).closest('tr');
    await waitFor(() => expect(within(row!).getByText('user:1')).toBeInTheDocument());
    expect(within(row!).getByRole('button', { name: /review/i })).toBeEnabled();
  });

  it('shows rows in the order the API returned them, without sorting by deletion time', async () => {
    mockAlertRulesResponse({
      items: [
        buildAlertRule(
          { metadata: { name: 'oldest', deletionTimestamp: '2024-01-01T00:00:00Z' } },
          { title: 'Deleted first' }
        ),
        buildAlertRule(
          { metadata: { name: 'newest', deletionTimestamp: '2024-06-01T00:00:00Z' } },
          { title: 'Deleted last' }
        ),
        buildAlertRule(
          { metadata: { name: 'middle', deletionTimestamp: '2024-03-01T00:00:00Z' } },
          { title: 'Deleted between' }
        ),
      ],
      metadata: {},
    });

    render(<AlertRulesRecentlyDeleted />);

    await screen.findByText('Deleted first');
    const titles = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[0].textContent);
    expect(titles).toEqual(['Deleted first', 'Deleted last', 'Deleted between']);
  });

  it('reports the number of items the API returned, not the rows revealed', async () => {
    const rules = Array.from({ length: 65 }, (_, i) =>
      buildAlertRule({ metadata: { name: `rule-${i}` } }, { title: `Rule ${i}` })
    );
    mockAlertRulesResponse({ items: rules, metadata: {} });

    render(<AlertRulesRecentlyDeleted />);

    await screen.findByText('Rule 0');
    expect(reportInteractionMock).toHaveBeenCalledWith(
      'grafana_alerting_deleted_rules_load_result',
      expect.objectContaining({ kind: 'alert', outcome: 'success', rowCount: 65 })
    );
  });

  it('loads the continuation page once when Load more is double clicked', async () => {
    const tokens: Array<string | null> = [];
    let releasePage: () => void = () => {};
    const pageGate = new Promise<void>((resolve) => {
      releasePage = resolve;
    });
    const rules = Array.from({ length: 40 }, (_, i) =>
      buildAlertRule({ metadata: { name: `rule-${i}` } }, { title: `Rule ${i}` })
    );
    server.use(
      http.get(ALERT_RULES_URL, async ({ request }) => {
        const token = new URL(request.url).searchParams.get('continue');
        tokens.push(token);
        if (!token) {
          return HttpResponse.json({ items: rules, metadata: { continue: 'next-page-token' } });
        }
        await pageGate;
        return HttpResponse.json({
          items: [buildAlertRule({ metadata: { name: 'rule-last' } }, { title: 'Last rule' })],
          metadata: {},
        });
      })
    );

    const { user } = render(<AlertRulesRecentlyDeleted />);
    await screen.findByText('Rule 0');
    await user.dblClick(screen.getByRole('button', { name: /load more/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /load more/i })).toBeDisabled());
    releasePage();

    expect(await screen.findByText('Last rule')).toBeInTheDocument();
    expect(tokens).toEqual([null, 'next-page-token']);
  });

  it('a failed first load shows an error (not the empty state) with Retry, and Retry loads the rules', async () => {
    let call = 0;
    server.use(
      http.get(ALERT_RULES_URL, () => {
        call += 1;
        return call === 1
          ? HttpResponse.json({ message: 'boom' }, { status: 500 })
          : HttpResponse.json({ items: [buildAlertRule()], metadata: {} });
      })
    );

    const { user } = render(<AlertRulesRecentlyDeleted />);

    expect(await screen.findByText(/unable to load recently deleted rules/i)).toBeInTheDocument();
    expect(screen.queryByText(/no recently deleted rules found/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('High CPU usage')).toBeInTheDocument();
    expect(reportInteractionMock).toHaveBeenCalledWith(
      'grafana_alerting_deleted_rules_load_result',
      expect.objectContaining({ kind: 'alert', outcome: 'error', rowCount: 0 })
    );
  });

  it('a failed Load more keeps the loaded rows, and Retry repeats the same continuation request', async () => {
    const tokens: Array<string | null> = [];
    let failNext = true;
    const rules = Array.from({ length: 40 }, (_, i) =>
      buildAlertRule({ metadata: { name: `rule-${i}` } }, { title: `Rule ${i}` })
    );
    server.use(
      http.get(ALERT_RULES_URL, ({ request }) => {
        const token = new URL(request.url).searchParams.get('continue');
        tokens.push(token);
        if (!token) {
          return HttpResponse.json({ items: rules, metadata: { continue: 'next-page-token' } });
        }
        if (failNext) {
          failNext = false;
          return HttpResponse.json({ message: 'boom' }, { status: 500 });
        }
        return HttpResponse.json({
          items: [buildAlertRule({ metadata: { name: 'rule-last' } }, { title: 'Last rule' })],
          metadata: {},
        });
      })
    );

    const { user } = render(<AlertRulesRecentlyDeleted />);
    await screen.findByText('Rule 0');
    await user.click(screen.getByRole('button', { name: /load more/i }));

    expect(await screen.findByText('Failed to load more results')).toBeInTheDocument();
    expect(screen.getByText('Rule 39')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Last rule')).toBeInTheDocument();
    expect(screen.getByText('Rule 0')).toBeInTheDocument();
    expect(tokens).toEqual([null, 'next-page-token', 'next-page-token']);
  });
});
