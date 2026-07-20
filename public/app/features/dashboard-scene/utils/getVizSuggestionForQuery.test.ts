import { of, Subject } from 'rxjs';

import { LoadingState, type PanelPluginVisualizationSuggestion } from '@grafana/data';
import { type DataSourceSrv, getDataSourceSrv } from '@grafana/runtime';
import { SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { getAllSuggestions } from 'app/features/panel/suggestions/getAllSuggestions';
import { getNextRequestId } from 'app/features/query/state/PanelQueryRunner';
import { runRequest } from 'app/features/query/state/runRequest';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { applyQueryToPanel, getVizSuggestionForQuery } from './getVizSuggestionForQuery';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
}));

jest.mock('app/features/query/state/runRequest', () => ({
  runRequest: jest.fn(),
}));

jest.mock('app/features/query/state/PanelQueryRunner', () => ({
  getNextRequestId: jest.fn().mockReturnValue('request-1'),
}));

jest.mock('app/features/panel/suggestions/getAllSuggestions', () => ({
  getAllSuggestions: jest.fn(),
}));

const mockGetDataSourceSrv = getDataSourceSrv as jest.MockedFunction<typeof getDataSourceSrv>;
const mockRunRequest = runRequest as jest.MockedFunction<typeof runRequest>;
const mockGetAllSuggestions = getAllSuggestions as jest.MockedFunction<typeof getAllSuggestions>;
const mockGetNextRequestId = getNextRequestId as jest.MockedFunction<typeof getNextRequestId>;

const mockDatasource = { uid: 'test-ds', name: 'Test DS' };

const makeSuggestion = (pluginId = 'timeseries'): PanelPluginVisualizationSuggestion => ({
  pluginId,
  name: pluginId,
  description: '',
  options: { tooltip: { mode: 'single' } },
  fieldConfig: { defaults: {}, overrides: [] },
  hash: '0',
  score: 100,
});

const makeQuery = (overrides: Partial<DataQuery> = {}): DataQuery => ({
  refId: 'A',
  datasource: { uid: 'test-ds' },
  ...overrides,
});

function buildPanelWithQueryRunner() {
  const queryRunner = new SceneQueryRunner({ datasource: { uid: 'test-ds' }, queries: [] });
  const panel = new VizPanel({
    pluginId: '__unconfigured-panel',
    $data: queryRunner,
  });
  return { panel, queryRunner };
}

describe('getVizSuggestionForQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDataSourceSrv.mockReturnValue({
      get: jest.fn().mockResolvedValue(mockDatasource),
    } as unknown as DataSourceSrv);

    mockGetNextRequestId.mockReturnValue('request-1');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the top suggestion for a query with data', async () => {
    const series = [{ fields: [], length: 0 }];
    const suggestion = makeSuggestion('timeseries');

    mockRunRequest.mockReturnValue(
      of({ state: LoadingState.Done, series, timeRange: {} as never, request: {} as never })
    );
    mockGetAllSuggestions.mockResolvedValue({ suggestions: [suggestion], hasErrors: false });

    const result = await getVizSuggestionForQuery(makeQuery());

    expect(result).toBe(suggestion);
  });

  it('returns undefined when there are no suggestions', async () => {
    mockRunRequest.mockReturnValue(
      of({ state: LoadingState.Done, series: [], timeRange: {} as never, request: {} as never })
    );
    mockGetAllSuggestions.mockResolvedValue({ suggestions: [], hasErrors: false });

    const result = await getVizSuggestionForQuery(makeQuery());

    expect(result).toBeUndefined();
  });

  it('resolves when the request errors', async () => {
    const suggestion = makeSuggestion('stat');

    mockRunRequest.mockReturnValue(
      of({ state: LoadingState.Error, series: [], timeRange: {} as never, request: {} as never })
    );
    mockGetAllSuggestions.mockResolvedValue({ suggestions: [suggestion], hasErrors: false });

    const result = await getVizSuggestionForQuery(makeQuery());

    expect(result).toBe(suggestion);
  });

  it('only waits for Done or Error state, skipping Loading emissions', async () => {
    const suggestion = makeSuggestion('barchart');

    mockRunRequest.mockReturnValue(
      of(
        { state: LoadingState.Loading, series: [], timeRange: {} as never, request: {} as never },
        { state: LoadingState.Done, series: [], timeRange: {} as never, request: {} as never }
      )
    );
    mockGetAllSuggestions.mockResolvedValue({ suggestions: [suggestion], hasErrors: false });

    const result = await getVizSuggestionForQuery(makeQuery());

    expect(result).toBe(suggestion);
    // getAllSuggestions should only have been called once (for the Done emission)
    expect(mockGetAllSuggestions).toHaveBeenCalledTimes(1);
  });

  it('rejects with TimeoutError when the request never emits a terminal state', async () => {
    jest.useFakeTimers();

    // A Subject that never emits Done or Error
    const subject = new Subject<never>();
    mockRunRequest.mockReturnValue(subject);

    const promise = getVizSuggestionForQuery(makeQuery());
    // Attach the rejection handler before advancing timers to avoid unhandled rejection
    const expectation = expect(promise).rejects.toThrow();

    // Advance past the 5s timeout, flushing microtasks between each tick
    await jest.advanceTimersByTimeAsync(5_001);

    await expectation;

    jest.useRealTimers();
  });

  it('passes the query to the request targets', async () => {
    const query = makeQuery({ refId: 'B' });

    mockRunRequest.mockReturnValue(
      of({ state: LoadingState.Done, series: [], timeRange: {} as never, request: {} as never })
    );
    mockGetAllSuggestions.mockResolvedValue({ suggestions: [], hasErrors: false });

    await getVizSuggestionForQuery(query);

    expect(mockRunRequest).toHaveBeenCalledWith(mockDatasource, expect.objectContaining({ targets: [query] }));
  });
});

describe('applyQueryToPanel', () => {
  let dashboard: DashboardScene;

  beforeEach(() => {
    dashboard = new DashboardScene({
      title: 'Test dashboard',
      uid: 'test-uid',
      body: DefaultGridLayoutManager.createEmpty(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockApplySetup(panel: VizPanel, queryRunner?: SceneQueryRunner) {
    jest.spyOn(dashboard, 'changePanelPlugin').mockResolvedValue(undefined);
    jest.spyOn(dashboard, 'updatePanelTitle').mockImplementation(() => {});
    if (queryRunner) {
      jest.spyOn(queryRunner, 'runQueries').mockImplementation(() => {});
    }
  }

  it('calls changePanelPlugin with suggestion pluginId, options, and fieldConfig', async () => {
    const { panel, queryRunner } = buildPanelWithQueryRunner();
    const suggestion = makeSuggestion('timeseries');
    const query = makeQuery();

    mockApplySetup(panel, queryRunner);

    await applyQueryToPanel(panel, dashboard, query, suggestion);

    expect(dashboard.changePanelPlugin).toHaveBeenCalledWith(
      panel,
      'timeseries',
      suggestion.options,
      suggestion.fieldConfig
    );
  });

  it('updates the panel title when one is provided', async () => {
    const { panel, queryRunner } = buildPanelWithQueryRunner();
    const suggestion = makeSuggestion();
    const query = makeQuery();

    mockApplySetup(panel, queryRunner);

    await applyQueryToPanel(panel, dashboard, query, suggestion, 'My Saved Query');

    expect(dashboard.updatePanelTitle).toHaveBeenCalledWith(panel, 'My Saved Query');
  });

  it('does not update the panel title when title is not provided', async () => {
    const { panel, queryRunner } = buildPanelWithQueryRunner();
    const suggestion = makeSuggestion();
    const query = makeQuery();

    mockApplySetup(panel, queryRunner);

    await applyQueryToPanel(panel, dashboard, query, suggestion);

    expect(dashboard.updatePanelTitle).not.toHaveBeenCalled();
  });

  it('sets datasource and queries on the query runner and triggers execution', async () => {
    const { panel, queryRunner } = buildPanelWithQueryRunner();
    const suggestion = makeSuggestion();
    const query = makeQuery({ refId: 'A', datasource: { uid: 'my-ds' } });

    mockApplySetup(panel, queryRunner);
    const setStateSpy = jest.spyOn(queryRunner, 'setState');

    await applyQueryToPanel(panel, dashboard, query, suggestion);

    expect(setStateSpy).toHaveBeenCalledWith({
      datasource: { uid: 'my-ds' },
      queries: [{ ...query, refId: 'A' }],
    });
    expect(queryRunner.runQueries).toHaveBeenCalled();
  });

  it('falls back to refId "A" when query has no refId', async () => {
    const { panel, queryRunner } = buildPanelWithQueryRunner();
    const suggestion = makeSuggestion();
    const query = makeQuery({ refId: '' });

    mockApplySetup(panel, queryRunner);
    const setStateSpy = jest.spyOn(queryRunner, 'setState');

    await applyQueryToPanel(panel, dashboard, query, suggestion);

    expect(setStateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queries: [expect.objectContaining({ refId: 'A' })] })
    );
  });

  it('does not throw when the panel has no query runner', async () => {
    const panel = new VizPanel({ pluginId: '__unconfigured-panel' });
    const suggestion = makeSuggestion();
    const query = makeQuery();

    jest.spyOn(dashboard, 'changePanelPlugin').mockResolvedValue(undefined);
    jest.spyOn(dashboard, 'updatePanelTitle').mockImplementation(() => {});

    await expect(applyQueryToPanel(panel, dashboard, query, suggestion)).resolves.toBeUndefined();
  });
});
