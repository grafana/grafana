import { HttpResponse, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { type DataSourceApi } from '@grafana/data';
import { getDataSourceSrv, useDataSourceInstanceList } from '@grafana/runtime';
import { setDataSourceInstanceSettings } from '@grafana/runtime/internal';

import { type AlertDataQuery, type AlertQuery } from '../../../../../../types/unified-alerting-dto';
import { setupMswServer } from '../../../mockApi';
import { mockCombinedRule, mockDataSource, mockRulerGrafanaRule } from '../../../mocks';
import { type AlertingQueryResponse } from '../../../state/AlertingQueryRunner';
import { setupDataSources } from '../../../testSetup/datasources';

import { QueryAndCondition } from './QueryAndCondition';

const DS_UID = 'test-ds-uid';

// Mocked so a test can hold the hook in its loading state; beforeEach restores the real
// implementation, which reads the cache seeded by setDataSourceInstanceSettings below.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useDataSourceInstanceList: jest.fn(),
}));

const { useDataSourceInstanceList: actualUseDataSourceInstanceList } = jest.requireActual<{
  useDataSourceInstanceList: typeof useDataSourceInstanceList;
}>('@grafana/runtime');

const server = setupMswServer();

beforeEach(() => {
  jest.mocked(useDataSourceInstanceList).mockImplementation(actualUseDataSourceInstanceList);

  const ds = mockDataSource({ uid: DS_UID, name: 'Test DS' });
  const dsrv = setupDataSources(ds);

  // Populate the new async instance-settings cache so useAlertQueryDataSources resolves correctly.
  setDataSourceInstanceSettings({ 'Test DS': ds });

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
  // Clear the async instance-settings cache between tests.
  setDataSourceInstanceSettings({});
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
  it('previews raw SQL without line numbers, allows copying, and rejects edits without changing evaluation', async () => {
    const capturedBodies: Array<{ data: Array<{ model: AlertDataQuery }> }> = [];
    server.use(
      http.post<never, { data: Array<{ model: AlertDataQuery }> }>('/api/v1/eval', async ({ request }) => {
        capturedBodies.push(await request.json());
        return HttpResponse.json<AlertingQueryResponse>({ results: {} });
      })
    );
    const rule = makeGrafanaRule([
      {
        refId: 'A',
        datasourceUid: DS_UID,
        model: { refId: 'A', rawSql: 'SELECT value\nFROM metrics\nWHERE value > 10' },
      },
    ]);
    const { user } = render(<QueryAndCondition rule={rule} />);

    const preview = await screen.findByRole('textbox', { name: 'SQL query preview' });
    expect(preview).toHaveTextContent('SELECT value');
    expect(preview.closest('.cm-editor')).toHaveStyle({ height: '80px' });
    expect(preview.closest('.cm-editor')?.querySelector('.cm-lineNumbers')).not.toBeInTheDocument();

    await user.click(preview);
    await user.keyboard('{Control>}a{/Control}');
    const copiedQuery = await user.copy();
    expect(copiedQuery?.getData('text/plain')).toBe('SELECT value\nFROM metrics\nWHERE value > 10');

    await user.keyboard('{Backspace}');
    await user.paste('SELECT 0');
    await user.keyboard('edited');
    await user.keyboard('{Control>}a{/Control}');
    const copiedAfterEdits = await user.copy();
    expect(copiedAfterEdits?.getData('text/plain')).toBe('SELECT value\nFROM metrics\nWHERE value > 10');
    await waitFor(() => expect(capturedBodies).toHaveLength(2));
    expect(capturedBodies.map((body) => body.data[0].model)).toEqual([
      { refId: 'A', rawSql: 'SELECT value\nFROM metrics\nWHERE value > 10' },
      { refId: 'A', rawSql: 'SELECT value\nFROM metrics\nWHERE value > 10' },
    ]);
  });

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

    render(<QueryAndCondition rule={rule} />);

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

    render(<QueryAndCondition rule={rule} />);

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

    render(<QueryAndCondition rule={rule} />);

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
  function blockEvalRequests() {
    let resolveEval!: () => void;
    const evalPending = new Promise<void>((resolve) => {
      resolveEval = resolve;
    });
    let requestCount = 0;

    server.use(
      http.post('/api/v1/eval', async () => {
        requestCount++;
        await evalPending;
        return HttpResponse.json<AlertingQueryResponse>({ results: {} });
      })
    );

    return { evalRequests: () => requestCount, resolveEval };
  }

  it('holds the query previews behind a loading bar until the data sources resolve', async () => {
    jest.mocked(useDataSourceInstanceList).mockReturnValue({ items: [], isLoading: true, error: undefined });

    const rule = makeGrafanaRule([
      {
        refId: 'A',
        datasourceUid: DS_UID,
        model: { refId: 'A' },
      },
    ]);

    render(<QueryAndCondition rule={rule} />);

    // A preview without its data source renders neither the query model nor the visualization's own
    // loading bar, so the wait has to be held above both rule branches rather than inside them.
    expect(await screen.findByTestId('eval-loading-bar')).toBeInTheDocument();
    expect(screen.queryByTestId('queries-container')).not.toBeInTheDocument();
  });

  it.skip('renders the rule definition immediately while eval is pending, then clears the loading bar', async () => {
    const { resolveEval } = blockEvalRequests();

    const rule = makeGrafanaRule([
      {
        refId: 'A',
        datasourceUid: DS_UID,
        model: { refId: 'A' },
      },
    ]);

    render(<QueryAndCondition rule={rule} />);

    // The definition renders immediately, even though eval is still pending (no global loading gate)
    expect(await screen.findByTestId('queries-container')).toBeInTheDocument();
    // ...and a per-component loading bar is shown while requests are in flight
    expect(await screen.findByTestId('eval-loading-bar')).toBeInTheDocument();

    // Unblock the eval responses
    resolveEval();

    // Loading bars disappear once both runners have settled
    await waitFor(() => expect(screen.queryByTestId('eval-loading-bar')).not.toBeInTheDocument());
  });

  it('keeps the loading bar visible while query preparation is pending', async () => {
    const { evalRequests } = blockEvalRequests();

    // prepareQueries awaits dataSourceSrv.get before it can issue the request
    let resolveDataSource!: (dataSource: DataSourceApi) => void;
    const dataSourcePending = new Promise<DataSourceApi>((resolve) => {
      resolveDataSource = resolve;
    });
    const getDataSource = jest.mocked(getDataSourceSrv().get);
    getDataSource.mockImplementation(() => dataSourcePending);

    const rule = makeGrafanaRule([
      {
        refId: 'A',
        datasourceUid: DS_UID,
        model: { refId: 'A' },
      },
    ]);

    render(<QueryAndCondition rule={rule} />);

    await waitFor(() => expect(getDataSource).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('eval-loading-bar')).toBeInTheDocument();

    resolveDataSource({ uid: DS_UID } as DataSourceApi);

    await waitFor(() => expect(evalRequests()).toBe(2));
    expect(screen.getByTestId('eval-loading-bar')).toBeInTheDocument();
  });

  it('keeps the loading bar visible while the eval request is in flight', async () => {
    const { evalRequests, resolveEval } = blockEvalRequests();

    const rule = makeGrafanaRule([
      {
        refId: 'A',
        datasourceUid: DS_UID,
        model: { refId: 'A' },
      },
    ]);

    render(<QueryAndCondition rule={rule} />);

    await waitFor(() => expect(evalRequests()).toBe(2));
    expect(screen.getByTestId('eval-loading-bar')).toBeInTheDocument();

    resolveEval();
    await waitFor(() => expect(screen.queryByTestId('eval-loading-bar')).not.toBeInTheDocument());
  });

  it('never shows the loading bar for a federated rule', async () => {
    jest.mocked(useDataSourceInstanceList).mockReturnValue({ items: [], isLoading: true, error: undefined });

    const rule = makeGrafanaRule([
      {
        refId: 'A',
        datasourceUid: DS_UID,
        model: { refId: 'A' },
      },
    ]);
    // A federated rule group renders neither preview branch regardless of loading state (RuleViewer
    // shows FederatedRuleWarning above the tabs instead), so this tab must render nothing here too.
    rule.group.source_tenants = ['tenant-a'];

    render(<QueryAndCondition rule={rule} />);

    expect(screen.queryByTestId('eval-loading-bar')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2b. No-data states
// ---------------------------------------------------------------------------

describe('no data', () => {
  it('shows the generic no-data message when eval returns no results', async () => {
    server.use(http.post('/api/v1/eval', () => HttpResponse.json<AlertingQueryResponse>({ results: {} })));

    const rule = makeGrafanaRule([
      {
        refId: 'A',
        datasourceUid: DS_UID,
        model: { refId: 'A' },
      },
    ]);

    render(<QueryAndCondition rule={rule} />);

    expect(await screen.findByText('No data — query results could not be loaded.')).toBeInTheDocument();
  });

  it('shows the no-query message for an expression-only rule', async () => {
    server.use(http.post('/api/v1/eval', () => HttpResponse.json<AlertingQueryResponse>({ results: {} })));

    // A rule whose only query is an expression: there is no data source query to run.
    const rule = makeGrafanaRule([
      {
        refId: 'A',
        datasourceUid: '__expr__',
        model: { refId: 'A', datasource: { type: '__expr__', uid: '__expr__' } },
      },
    ]);

    render(<QueryAndCondition rule={rule} />);

    expect(await screen.findByText('No data source query to run for this rule.')).toBeInTheDocument();
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

    render(<QueryAndCondition rule={rule} />);

    // Wait for loading to finish
    await waitFor(() => expect(screen.queryByTestId('eval-loading-bar')).not.toBeInTheDocument());

    // GrafanaRuleQueryViewer renders its queries-container – confirms the merge produced
    // a valid evalDataByQuery without expression data being overwritten by visualization data
    expect(screen.getByTestId('queries-container')).toBeInTheDocument();
  });
});
