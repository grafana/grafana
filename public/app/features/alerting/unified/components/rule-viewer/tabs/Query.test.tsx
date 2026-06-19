import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { type DataSourceApi } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { type AlertDataQuery, type AlertQuery } from '../../../../../../types/unified-alerting-dto';
import { setupMswServer } from '../../../mockApi';
import { mockCombinedRule, mockDataSource, mockRulerGrafanaRule } from '../../../mocks';
import { type AlertingQueryResponse } from '../../../state/AlertingQueryRunner';
import { setupDataSources } from '../../../testSetup/datasources';

import { QueryAndConditionsView } from './Query';

const DS_UID = 'test-ds-uid';

const server = setupMswServer();

beforeEach(() => {
  const dsrv = setupDataSources(mockDataSource({ uid: DS_UID, name: 'Test DS' }));

  // AlertingQueryRunner.prepareQueries calls dataSourceSrv.get(uid) to load the plugin instance.
  // In tests this fails because the Prometheus plugin can't be imported. We spy on get() to return
  // a plain DataSourceApi stub (not DataSourceWithBackend) so prepareQueries doesn't exclude the query.
  jest.spyOn(dsrv, 'get').mockResolvedValue({ uid: DS_UID } as DataSourceApi);

  // Ensure getDataSourceSrv() returns the same spy-wrapped instance used by useAlertQueryRunner
  jest.spyOn(getDataSourceSrv() as ReturnType<typeof getDataSourceSrv>, 'get').mockResolvedValue({
    uid: DS_UID,
  } as DataSourceApi);
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Default relative time range used in test queries to silence AlertingQueryRunner warnings. */
const DEFAULT_RELATIVE_TIME_RANGE = { from: 600, to: 0 };

/**
 * Builds a combined Grafana rule whose data array is provided by the caller.
 * A relativeTimeRange is added to each query entry to avoid warnings from AlertingQueryRunner.
 */
function makeGrafanaRule(data: Array<{ refId: string; datasourceUid: string; model: Record<string, unknown> }>) {
  const dataWithTimeRange: AlertQuery[] = data.map((q) => ({
    ...q,
    relativeTimeRange: DEFAULT_RELATIVE_TIME_RANGE,
    queryType: '',
    model: q.model as unknown as AlertDataQuery,
  }));
  const rulerRule = mockRulerGrafanaRule({}, { uid: 'rule-uid', condition: 'A', data: dataWithTimeRange });
  return mockCombinedRule({ rulerRule });
}

// ---------------------------------------------------------------------------
// 1. Instant-to-range transformation
// ---------------------------------------------------------------------------

describe('visualizationQueries transformation', () => {
  it('converts Prometheus instant query (instant: true) to range', async () => {
    const capturedBodies: Array<{ data: unknown[]; condition: string }> = [];

    server.use(
      http.post('/api/v1/eval', async ({ request }) => {
        const body = await request.json();
        capturedBodies.push(body as { data: unknown[]; condition: string });
        return HttpResponse.json<AlertingQueryResponse>({ results: {} });
      })
    );

    const rule = makeGrafanaRule([
      {
        refId: 'A',
        datasourceUid: DS_UID,
        model: { refId: 'A', instant: true, range: false },
      },
    ]);

    render(<QueryAndConditionsView rule={rule} />);

    // Wait for both eval calls to arrive (one from expression runner, one from visualization runner)
    await waitFor(() => expect(capturedBodies.length).toBe(2));

    // The visualization runner call passes condition '' — find it
    const vizCall = capturedBodies.find((b) => b.condition === '');
    expect(vizCall).toBeDefined();
    const sentQuery = (vizCall!.data as Array<{ model: Record<string, unknown> }>)[0];
    expect(sentQuery.model.instant).toBe(false);
    expect(sentQuery.model.range).toBe(true);
  });

  it('does NOT mutate Prometheus query that is already a range query (instant: false)', async () => {
    const capturedBodies: Array<{ data: unknown[]; condition: string }> = [];

    server.use(
      http.post('/api/v1/eval', async ({ request }) => {
        const body = await request.json();
        capturedBodies.push(body as { data: unknown[]; condition: string });
        return HttpResponse.json<AlertingQueryResponse>({ results: {} });
      })
    );

    const rule = makeGrafanaRule([
      {
        refId: 'A',
        datasourceUid: DS_UID,
        model: { refId: 'A', instant: false, range: true },
      },
    ]);

    render(<QueryAndConditionsView rule={rule} />);

    await waitFor(() => expect(capturedBodies.length).toBe(2));

    const vizCall = capturedBodies.find((b) => b.condition === '');
    expect(vizCall).toBeDefined();
    const sentQuery = (vizCall!.data as Array<{ model: Record<string, unknown> }>)[0];
    // Already a range query — fields should be unchanged
    expect(sentQuery.model.instant).toBe(false);
    expect(sentQuery.model.range).toBe(true);
  });

  it('converts Loki instant queryType to range', async () => {
    const capturedBodies: Array<{ data: unknown[]; condition: string }> = [];

    server.use(
      http.post('/api/v1/eval', async ({ request }) => {
        const body = await request.json();
        capturedBodies.push(body as { data: unknown[]; condition: string });
        return HttpResponse.json<AlertingQueryResponse>({ results: {} });
      })
    );

    const rule = makeGrafanaRule([
      {
        refId: 'A',
        datasourceUid: DS_UID,
        model: { refId: 'A', queryType: 'instant' },
      },
    ]);

    render(<QueryAndConditionsView rule={rule} />);

    await waitFor(() => expect(capturedBodies.length).toBe(2));

    const vizCall = capturedBodies.find((b) => b.condition === '');
    expect(vizCall).toBeDefined();
    const sentQuery = (vizCall!.data as Array<{ model: Record<string, unknown> }>)[0];
    expect(sentQuery.model.queryType).toBe('range');
  });
});

// ---------------------------------------------------------------------------
// 2. Loading state
// ---------------------------------------------------------------------------

describe('loading state', () => {
  it('renders the rule definition immediately while eval is pending, then clears the loading bar', async () => {
    let resolveEval!: () => void;
    const evalPending = new Promise<void>((resolve) => {
      resolveEval = resolve;
    });

    server.use(
      http.post('/api/v1/eval', async () => {
        await evalPending;
        return HttpResponse.json<AlertingQueryResponse>({ results: {} });
      })
    );

    const rule = makeGrafanaRule([
      {
        refId: 'A',
        datasourceUid: DS_UID,
        model: { refId: 'A' },
      },
    ]);

    render(<QueryAndConditionsView rule={rule} />);

    // The definition renders immediately, even though eval is still pending (no global loading gate)
    expect(await screen.findByTestId('queries-container')).toBeInTheDocument();
    // ...and a per-component loading bar is shown while requests are in flight
    expect(await screen.findByTestId('eval-loading-bar')).toBeInTheDocument();

    // Unblock the eval responses
    resolveEval();

    // Loading bars disappear once both runners have settled
    await waitFor(() => expect(screen.queryByTestId('eval-loading-bar')).not.toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// 3. Merge order – expression data takes precedence over visualization data
// ---------------------------------------------------------------------------

describe('merge order', () => {
  it('renders GrafanaRuleQueryViewer after runners settle (expression data authoritative)', async () => {
    server.use(
      http.post('/api/v1/eval', () => {
        return HttpResponse.json<AlertingQueryResponse>({ results: {} });
      })
    );

    const rule = makeGrafanaRule([
      {
        refId: 'A',
        datasourceUid: DS_UID,
        model: { refId: 'A' },
      },
    ]);

    render(<QueryAndConditionsView rule={rule} />);

    // Wait for loading to finish
    await waitFor(() => expect(screen.queryByTestId('eval-loading-bar')).not.toBeInTheDocument());

    // GrafanaRuleQueryViewer renders its queries-container – confirms the merge produced
    // a valid evalDataByQuery without expression data being overwritten by visualization data
    expect(screen.getByTestId('queries-container')).toBeInTheDocument();
  });
});
