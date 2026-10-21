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

import { FOLDER_PARENTS_URL, rulesUrl } from '../../mocks/handlers';

import { RecordingRulesRecentlyDeleted } from './RecordingRulesRecentlyDeleted';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const reportInteractionMock = jest.mocked(reportInteraction);

const RECORDING_RULES_URL = rulesUrl('recording');
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

  it('requests only the RecordingRule trash selector, with no title/folder/user filter or Refresh controls', async () => {
    let requestedSelector: string | null = null;
    mockRecordingRulesResponse({ items: [buildRecordingRule()], metadata: {} }, (url) => {
      requestedSelector = url.searchParams.get('labelSelector');
    });

    render(<RecordingRulesRecentlyDeleted />);

    await screen.findByText('CPU usage average');

    expect(requestedSelector).toBe('grafana.app/get-trash=true');
    expect(reportInteractionMock).toHaveBeenCalledWith(
      'grafana_alerting_deleted_rules_load_result',
      expect.objectContaining({ kind: 'recording', outcome: 'success', rowCount: 1 })
    );
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
  });

  it('shows title, recorded metric, target data source, and resolved folder path', async () => {
    mockRecordingRulesResponse({ items: [buildRecordingRule()], metadata: {} });

    render(<RecordingRulesRecentlyDeleted />);

    const row = (await screen.findByText('CPU usage average')).closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getByText('cpu_usage:avg')).toBeInTheDocument();
    expect(within(row!).getByText('Prometheus')).toBeInTheDocument();
    await waitFor(() => expect(within(row!).getByText('Production')).toBeInTheDocument());
  });

  it('Review shows the recording-specific fields and no alert-only language', async () => {
    mockRecordingRulesResponse({ items: [buildRecordingRule()], metadata: {} });
    const { user } = render(<RecordingRulesRecentlyDeleted />);

    await screen.findByText('CPU usage average');
    // Wait for the lookups to settle, or the click can hit a node that gets replaced.
    await screen.findByText('Production');
    const row = screen.getByText('CPU usage average').closest('tr');
    await user.click(within(row!).getByRole('button', { name: /review/i }));

    expect(await screen.findByText('Deleted recording rule')).toBeInTheDocument();
    // The row behind the drawer shows these values too, so a second match means the drawer opened.
    expect(screen.getAllByText('cpu_usage:avg').length).toBe(2);
    expect(screen.getAllByText('Prometheus').length).toBe(2);
    expect(screen.queryByText(/firing|instances|notification routing/i)).not.toBeInTheDocument();
  });

  it('falls back to the target data source UID when it does not resolve to a known data source', async () => {
    mockRecordingRulesResponse({
      items: [buildRecordingRule({}, { targetDatasourceUID: 'unknown-ds-uid' })],
      metadata: {},
    });

    render(<RecordingRulesRecentlyDeleted />);

    const row = (await screen.findByText('CPU usage average')).closest('tr');
    expect(within(row!).getByText('unknown-ds-uid')).toBeInTheDocument();
  });
});
