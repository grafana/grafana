import { HttpResponse, http } from 'msw';
import { render, screen, waitFor, within } from 'test/test-utils';

import { getAPIBaseURL } from '@grafana/api-clients';
import { type RecordingRule, type RecordingRuleList } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';

import { RecordingRulesRecentlyDeleted } from './RecordingRulesRecentlyDeleted';

const RECORDING_RULES_URL = `${getAPIBaseURL('rules.alerting.grafana.app', 'v0alpha1')}/recordingrules`;
const FOLDER_PARENTS_URL = `${getAPIBaseURL('folder.grafana.app', 'v1beta1')}/folders/:name/parents`;
const DISPLAY_MAPPING_URL = `${getAPIBaseURL('iam.grafana.app', 'v0alpha1')}/display`;

function buildRecordingRule(overrides: Partial<RecordingRule> = {}): RecordingRule {
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

  it('RDEL-1: requests only the RecordingRule trash selector, with no title/folder/user filter controls', async () => {
    let requestedSelector: string | null = null;
    mockRecordingRulesResponse({ items: [buildRecordingRule()], metadata: {} }, (url) => {
      requestedSelector = url.searchParams.get('labelSelector');
    });

    render(<RecordingRulesRecentlyDeleted />);

    await screen.findByText('CPU usage average');

    expect(requestedSelector).toBe('grafana.app/get-trash=true');
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
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

  it('RDEL-4: an initial failure shows an error rather than the empty state', async () => {
    server.use(http.get(RECORDING_RULES_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

    render(<RecordingRulesRecentlyDeleted />);

    expect(await screen.findByText(/unable to load recently deleted rules/i)).toBeInTheDocument();
    expect(screen.queryByText(/no recently deleted rules found/i)).not.toBeInTheDocument();
  });

  it('RDEL-4: shows the empty state only after a successful empty response', async () => {
    mockRecordingRulesResponse({ items: [], metadata: {} });

    render(<RecordingRulesRecentlyDeleted />);

    expect(await screen.findByText(/no recently deleted rules found/i)).toBeInTheDocument();
  });

  it('RDEL-4: a later Load more failure keeps the loaded rows visible and offers retry', async () => {
    // An exact 40-item first page with a continue token empties the local buffer, so the next
    // Load more click must hit the network (unlike an oversized first response) - that's the
    // request this test makes fail.
    const rules = Array.from({ length: 40 }, (_, i) =>
      buildRecordingRule({
        metadata: { name: `rule-${i}`, annotations: { 'grafana.app/folder': 'folder-uid-1' } },
        spec: { ...buildRecordingRule().spec, title: `Rule ${i}` },
      })
    );
    server.use(
      http.get(RECORDING_RULES_URL, ({ request }) => {
        const continueToken = new URL(request.url).searchParams.get('continue');
        if (!continueToken) {
          return HttpResponse.json({ items: rules, metadata: { continue: 'next-page-token' } });
        }
        return HttpResponse.json({ message: 'boom' }, { status: 500 });
      })
    );

    const { user } = render(<RecordingRulesRecentlyDeleted />);

    await screen.findByText('Rule 0');
    await user.click(screen.getByRole('button', { name: /load more/i }));

    expect(await screen.findByText(/unable to load more recently deleted rules/i)).toBeInTheDocument();
    expect(screen.getByText('Rule 0')).toBeInTheDocument();
    expect(screen.getByText('Rule 39')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
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
      items: [buildRecordingRule({ spec: { ...buildRecordingRule().spec, targetDatasourceUID: 'unknown-ds-uid' } })],
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
});
