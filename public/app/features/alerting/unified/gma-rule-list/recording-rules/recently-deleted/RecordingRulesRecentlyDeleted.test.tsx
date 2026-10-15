import { HttpResponse, http } from 'msw';
import { render, screen, waitFor, within } from 'test/test-utils';

import { getAPIBaseURL } from '@grafana/api-clients';
import { type RecordingRule, type RecordingRuleList } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { reportInteraction, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';

import { RecordingRulesRecentlyDeleted } from './RecordingRulesRecentlyDeleted';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const reportInteractionMock = jest.mocked(reportInteraction);

const RECORDING_RULES_URL = `${getAPIBaseURL('rules.alerting.grafana.app', 'v0alpha1')}/recordingrules`;
const FOLDER_PARENTS_URL = `${getAPIBaseURL('folder.grafana.app', 'v1beta1')}/folders/:name/parents`;
const DISPLAY_MAPPING_URL = `${getAPIBaseURL('iam.grafana.app', 'v0alpha1')}/display`;

function buildRecordingRule(
  overrides: Partial<RecordingRule> = {},
  specOverrides: Partial<RecordingRule['spec']> = {}
): RecordingRule {
  return {
    apiVersion: 'v0alpha1',
    kind: 'RecordingRule',
    metadata: {
      name: 'recording-rule-uid-1',
      annotations: {
        'grafana.app/folder': 'folder-uid-1',
        'grafana.app/updatedBy': 'user:1',
      },
      deletionTimestamp: '2024-05-01T00:00:00Z',
    },
    spec: {
      title: 'CPU usage average',
      metric: 'cpu_usage:avg',
      targetDatasourceUID: 'prometheus-uid',
      trigger: { interval: '1m' },
      expressions: {},
      ...specOverrides,
    },
    ...overrides,
  };
}

function mockRecordingRulesResponse(response: RecordingRuleList, requestAssertions?: (url: URL) => void) {
  server.use(
    http.get(RECORDING_RULES_URL, ({ request }) => {
      requestAssertions?.(new URL(request.url));
      return HttpResponse.json(response);
    })
  );
}

setBackendSrv(backendSrv);
setupMockServer();
setupDataSources(mockDataSource({ uid: 'prometheus-uid', name: 'Prometheus', type: DataSourceType.Prometheus }));

describe('RecordingRulesRecentlyDeleted', () => {
  beforeEach(() => {
    reportInteractionMock.mockClear();
    server.use(
      http.get(FOLDER_PARENTS_URL, ({ params }) => {
        return HttpResponse.json({ items: [{ name: String(params.name), title: 'Production' }] });
      }),
      http.get(DISPLAY_MAPPING_URL, ({ request }) => {
        const keys = new URL(request.url).searchParams.getAll('key');
        return HttpResponse.json({
          keys,
          display: keys.map((key) => ({ identity: { type: 'user', name: key }, displayName: `Display of ${key}` })),
        });
      })
    );
  });

  it('RDEL-1: requests only the RecordingRule trash selector, with no title/folder/user filter or Refresh controls', async () => {
    let requestedSelector: string | null = null;
    mockRecordingRulesResponse({ items: [buildRecordingRule()], metadata: {} }, (url) => {
      requestedSelector = url.searchParams.get('labelSelector');
    });

    render(<RecordingRulesRecentlyDeleted />);

    await screen.findByText('CPU usage average');

    expect(requestedSelector).toBe('grafana.app/get-trash=true');
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
  });

  it('RDEL-3: shows title, recorded metric, target data source, and resolved folder path', async () => {
    mockRecordingRulesResponse({ items: [buildRecordingRule()], metadata: {} });

    render(<RecordingRulesRecentlyDeleted />);

    const row = (await screen.findByText('CPU usage average')).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getByText('cpu_usage:avg')).toBeInTheDocument();
    expect(within(row!).getByText('Prometheus')).toBeInTheDocument();
    await waitFor(() => expect(within(row!).getByText('Production')).toBeInTheDocument());
  });

  it('RDEL-3: Review shows the recording-specific fields and no alert-only language', async () => {
    mockRecordingRulesResponse({ items: [buildRecordingRule()], metadata: {} });
    const { user } = render(<RecordingRulesRecentlyDeleted />);

    await screen.findByText('CPU usage average');
    // Wait for the async folder/deleted-by lookups to settle so the table stops re-rendering the
    // row before we grab and click its Review button - otherwise the click can target a node that
    // gets replaced mid-flight.
    await screen.findByText('Production');
    const row = screen.getByText('CPU usage average').closest('tr');
    await user.click(within(row!).getByRole('button', { name: /review/i }));

    expect(await screen.findByText('Deleted recording rule')).toBeInTheDocument();
    // The row behind the drawer also shows these values, so the drawer having opened means a
    // second match appears - not that these fields are drawer-exclusive.
    expect(screen.getAllByText('cpu_usage:avg').length).toBe(2);
    expect(screen.getAllByText('Prometheus').length).toBe(2);
    expect(screen.queryByText(/firing|instances|notification routing/i)).not.toBeInTheDocument();
  });

  it('RDEL-4: shows the empty state only after a successful empty response', async () => {
    mockRecordingRulesResponse({ items: [], metadata: {} });

    render(<RecordingRulesRecentlyDeleted />);

    expect(await screen.findByText(/no recently deleted rules found/i)).toBeInTheDocument();
  });

  it('RDEL-4: falls back to the folder UID when the folder lookup fails, without disabling Review', async () => {
    mockRecordingRulesResponse({ items: [buildRecordingRule()], metadata: {} });
    server.use(http.get(FOLDER_PARENTS_URL, () => HttpResponse.json({ message: 'not found' }, { status: 404 })));

    render(<RecordingRulesRecentlyDeleted />);

    const row = (await screen.findByText('CPU usage average')).closest('tr');
    await waitFor(() => expect(within(row!).getByText('folder-uid-1')).toBeInTheDocument());
    expect(within(row!).getByRole('button', { name: /review/i })).toBeEnabled();
  });

  it('RDEL-4: falls back to the target data source UID when it does not resolve to a known data source', async () => {
    mockRecordingRulesResponse({
      items: [buildRecordingRule({}, { targetDatasourceUID: 'unknown-ds-uid' })],
      metadata: {},
    });

    render(<RecordingRulesRecentlyDeleted />);

    const row = (await screen.findByText('CPU usage average')).closest('tr');
    expect(within(row!).getByText('unknown-ds-uid')).toBeInTheDocument();
  });

  it('RDEL-4: falls back to the updatedBy UID when the user-display lookup fails, without disabling the row', async () => {
    mockRecordingRulesResponse({ items: [buildRecordingRule()], metadata: {} });
    server.use(http.get(DISPLAY_MAPPING_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

    render(<RecordingRulesRecentlyDeleted />);

    const row = (await screen.findByText('CPU usage average')).closest('tr');
    await waitFor(() => expect(within(row!).getByText('user:1')).toBeInTheDocument());
    expect(within(row!).getByRole('button', { name: /review/i })).toBeEnabled();
  });

  it('RDEL-2: shows rows in the order the API returned them, without sorting by deletion time', async () => {
    const rule = buildRecordingRule();
    mockRecordingRulesResponse({
      items: [
        buildRecordingRule(
          { metadata: { ...rule.metadata, name: 'oldest', deletionTimestamp: '2024-01-01T00:00:00Z' } },
          { title: 'Deleted first' }
        ),
        buildRecordingRule(
          { metadata: { ...rule.metadata, name: 'newest', deletionTimestamp: '2024-06-01T00:00:00Z' } },
          { title: 'Deleted last' }
        ),
      ],
      metadata: {},
    });

    render(<RecordingRulesRecentlyDeleted />);

    await screen.findByText('Deleted first');
    const titles = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[0].textContent);
    expect(titles).toEqual(['Deleted first', 'Deleted last']);
  });

  it('RDEL-2: reports the number of items the API returned, not the rows revealed', async () => {
    const rules = Array.from({ length: 65 }, (_, i) =>
      buildRecordingRule({ metadata: { name: `rule-${i}` } }, { title: `Rule ${i}` })
    );
    mockRecordingRulesResponse({ items: rules, metadata: {} });

    render(<RecordingRulesRecentlyDeleted />);

    await screen.findByText('Rule 0');
    expect(reportInteractionMock).toHaveBeenCalledWith(
      'grafana_alerting_deleted_rules_load_result',
      expect.objectContaining({ kind: 'recording', outcome: 'success', rowCount: 65 })
    );
  });

  it('RDEL-4: a failed first load shows an error (not the empty state) and offers Retry, which loads the rules', async () => {
    let call = 0;
    server.use(
      http.get(RECORDING_RULES_URL, () => {
        call += 1;
        return call === 1
          ? HttpResponse.json({ message: 'boom' }, { status: 500 })
          : HttpResponse.json({ items: [buildRecordingRule()], metadata: {} });
      })
    );

    const { user } = render(<RecordingRulesRecentlyDeleted />);

    expect(await screen.findByText(/unable to load recently deleted rules/i)).toBeInTheDocument();
    expect(screen.queryByText(/no recently deleted rules found/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('CPU usage average')).toBeInTheDocument();
  });

  it('RDEL-2: reveals more than 40 rows from an oversized response in a 40-row chunk via Load more, without duplicate requests', async () => {
    let requestCount = 0;
    const rules = Array.from({ length: 65 }, (_, i) =>
      buildRecordingRule({ metadata: { name: `rule-${i}` } }, { title: `Rule ${i}` })
    );
    mockRecordingRulesResponse({ items: rules, metadata: {} }, () => {
      requestCount += 1;
    });

    const { user } = render(<RecordingRulesRecentlyDeleted />);

    await screen.findByText('Rule 0');
    expect(screen.getByText('Rule 39')).toBeInTheDocument();
    expect(screen.queryByText('Rule 40')).not.toBeInTheDocument();
    expect(requestCount).toBe(1);

    await user.click(screen.getByRole('button', { name: /load more/i }));

    await screen.findByText('Rule 40');
    expect(screen.getByText('Rule 64')).toBeInTheDocument();
    // The remaining rows came from the local buffer, so no second request was needed.
    expect(requestCount).toBe(1);
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('RDEL-2: follows a metadata.continue token via Load more', async () => {
    const requestedTokens: Array<string | null> = [];
    server.use(
      http.get(RECORDING_RULES_URL, ({ request }) => {
        const continueToken = new URL(request.url).searchParams.get('continue');
        requestedTokens.push(continueToken);
        if (!continueToken) {
          return HttpResponse.json({
            items: [buildRecordingRule({ metadata: { name: 'rule-page1' } }, { title: 'Page 1 rule' })],
            metadata: { continue: 'next-page-token' },
          });
        }
        return HttpResponse.json({
          items: [buildRecordingRule({ metadata: { name: 'rule-page2' } }, { title: 'Page 2 rule' })],
          metadata: {},
        });
      })
    );

    const { user } = render(<RecordingRulesRecentlyDeleted />);

    await screen.findByText('Page 1 rule');
    await user.click(screen.getByRole('button', { name: /load more/i }));

    await screen.findByText('Page 2 rule');
    expect(screen.getByText('Page 1 rule')).toBeInTheDocument();
    expect(requestedTokens).toEqual([null, 'next-page-token']);
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('STATE-4: loads the continuation page once when Load more is double clicked', async () => {
    const tokens: Array<string | null> = [];
    let releasePage: () => void = () => {};
    const pageGate = new Promise<void>((resolve) => {
      releasePage = resolve;
    });
    const rules = Array.from({ length: 40 }, (_, i) =>
      buildRecordingRule({ metadata: { name: `rule-${i}` } }, { title: `Rule ${i}` })
    );
    server.use(
      http.get(RECORDING_RULES_URL, async ({ request }) => {
        const token = new URL(request.url).searchParams.get('continue');
        tokens.push(token);
        if (!token) {
          return HttpResponse.json({ items: rules, metadata: { continue: 'next-page-token' } });
        }
        await pageGate;
        return HttpResponse.json({
          items: [buildRecordingRule({ metadata: { name: 'rule-last' } }, { title: 'Last rule' })],
          metadata: {},
        });
      })
    );

    const { user } = render(<RecordingRulesRecentlyDeleted />);
    await screen.findByText('Rule 0');
    await user.dblClick(screen.getByRole('button', { name: /load more/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /load more/i })).toBeDisabled());
    releasePage();

    expect(await screen.findByText('Last rule')).toBeInTheDocument();
    expect(tokens).toEqual([null, 'next-page-token']);
  });

  it('STATE-1: Retry after a failed Load more repeats the same continuation request and keeps the loaded rows', async () => {
    const tokens: Array<string | null> = [];
    let failNext = true;
    const rules = Array.from({ length: 40 }, (_, i) =>
      buildRecordingRule({ metadata: { name: `rule-${i}` } }, { title: `Rule ${i}` })
    );
    server.use(
      http.get(RECORDING_RULES_URL, ({ request }) => {
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
          items: [buildRecordingRule({ metadata: { name: 'rule-last' } }, { title: 'Last rule' })],
          metadata: {},
        });
      })
    );

    const { user } = render(<RecordingRulesRecentlyDeleted />);
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
