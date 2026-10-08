import { NEVER, of } from 'rxjs';

import {
  type DataQueryRequest,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  toDataFrame,
} from '@grafana/data';
import { setRunRequest } from '@grafana/runtime';
import { sceneGraph, SceneDataTransformer, SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { getMockDataSource } from 'app/features/query/state/mocks/mockDataSource';

import { startQueryPreview } from './queryPreview';

const queryA: DataQuery = { refId: 'A' };
const queryB: DataQuery = { refId: 'B' };
const proposedQuery: DataQuery = { refId: 'A', hide: true };
const optionOne: DataQuery & { expr: string } = { refId: 'A', expr: 'increase(http_requests_total[5m])' };
const optionTwo: DataQuery & { expr: string } = { refId: 'A', expr: 'sum(increase(http_requests_total[5m]))' };
const optionThree: DataQuery & { expr: string } = { refId: 'A', expr: 'sum by (code) (rate(http_requests_total[5m]))' };
const mockGetDataSource = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({ get: mockGetDataSource }),
}));

function setupPreview(state = LoadingState.Done) {
  const timeRange = new SceneTimeRange({ from: '2026-10-07T00:00:00Z', to: '2026-10-07T01:00:00Z' });
  const baselineData: PanelData = {
    state,
    timeRange: timeRange.state.value,
    series: [toDataFrame({ refId: 'A', fields: [{ name: 'value', type: FieldType.number, values: [10] }] })],
  };
  const queryRunner = new SceneQueryRunner({ queries: [queryA, queryB], data: baselineData });
  const panel = new VizPanel({ key: 'panel-1', $data: queryRunner, $timeRange: timeRange });
  const requests: SceneQueryRunner[] = [];
  const requestedQueries: DataQuery[][] = [];
  jest.mocked(SceneQueryRunner.prototype.cancelQuery).mockImplementation(function (this: SceneQueryRunner) {
    if (this.state.data) {
      this.setState({ data: { ...this.state.data, state: LoadingState.Done } });
    }
  });
  jest.mocked(SceneQueryRunner.prototype.runQueries).mockImplementation(function (this: SceneQueryRunner) {
    requests.push(this);
    requestedQueries.push(this.state.queries);
    this.setState({
      data: { state: LoadingState.Loading, series: [], timeRange: sceneGraph.getTimeRange(this).state.value },
    });
  });
  const result = (value: number): PanelData => ({
    state: LoadingState.Done,
    timeRange: timeRange.state.value,
    series: [toDataFrame({ refId: 'A', fields: [{ name: 'value', type: FieldType.number, values: [value] }] })],
  });
  return { baselineData, panel, queryRunner, requests, requestedQueries, result, timeRange };
}

describe('startQueryPreview', () => {
  it('caches Original and each option, runs each option once, and never projects an empty Loading frame', () => {
    const { baselineData, panel, queryRunner, requests, requestedQueries, result } = setupPreview();
    const projections: PanelData[] = [];
    queryRunner.subscribeToState((state) => {
      if (state.data) {
        projections.push(state.data);
      }
    });
    const preview = startQueryPreview(panel, 'A', optionOne)!;
    expect(queryRunner.state.data).toBe(baselineData);
    expect(preview.data?.state).toBe(LoadingState.Loading);
    const first = result(11);
    requests[0].setState({ data: first });
    preview.select(queryA);
    expect(queryRunner.state.data).toBe(baselineData);
    preview.select(optionOne);
    expect(queryRunner.state.data).toBe(first);
    preview.select(optionTwo);
    expect(queryRunner.state.data).toBe(first);
    const second = result(12);
    requests[1].setState({ data: second });
    preview.select(optionThree);
    const third = result(13);
    requests[2].setState({ data: third });
    preview.select(queryA);
    expect(queryRunner.state.data).toBe(baselineData);
    expect(panel.state.$behaviors).toHaveLength(0);
    preview.select(optionOne);
    expect(queryRunner.state.data).toBe(first);
    expect(requestedQueries).toEqual([
      [optionOne, queryB],
      [optionTwo, queryB],
      [optionThree, queryB],
    ]);
    expect(queryRunner.state.queries).toEqual([queryA, queryB]);
    expect(projections.filter((data) => data.state === LoadingState.Loading && data.series.length === 0)).toEqual([]);
    preview.dispose();
    expect(queryRunner.state.data).toBe(baselineData);
  });

  it('peeks cached options and Original without a request and restores the selected result on release', () => {
    const { baselineData, panel, queryRunner, requests, result } = setupPreview();
    const preview = startQueryPreview(panel, 'A', optionOne)!;
    const first = result(11);
    requests[0].setState({ data: first });
    preview.select(optionTwo);
    const second = result(12);
    requests[1].setState({ data: second });
    preview.peek(optionOne);
    expect(queryRunner.state.data).toBe(first);
    preview.stopPeek();
    expect(queryRunner.state.data).toBe(second);
    preview.peek(queryA);
    expect(queryRunner.state.data).toBe(baselineData);
    preview.stopPeek();
    expect(queryRunner.state.data).toBe(second);
    expect(requests).toHaveLength(2);
    expect(queryRunner.state.queries).toEqual([queryA, queryB]);
    preview.dispose();
  });

  it('keeps the selected clone running during an uncached peek and caches its result without taking over', () => {
    const { panel, queryRunner, requests, result } = setupPreview();
    const preview = startQueryPreview(panel, 'A', optionOne)!;
    const selected = requests[0];
    const cancellations = jest.mocked(selected.cancelQuery).mock.calls.length;
    preview.peek(optionTwo);
    expect(panel.state.$behaviors).toEqual([selected, requests[1]]);
    expect(jest.mocked(selected.cancelQuery).mock.calls.length).toBe(cancellations);
    const peeked = result(12);
    requests[1].setState({ data: peeked });
    const first = result(11);
    selected.setState({ data: first });
    expect(queryRunner.state.data).toBe(peeked);
    preview.stopPeek();
    expect(queryRunner.state.data).toBe(first);
    expect(panel.state.$behaviors).toHaveLength(0);
    preview.select(optionTwo);
    expect(queryRunner.state.data).toBe(peeked);
    expect(requests).toHaveLength(2);
    preview.dispose();
  });

  it('restores the selected snapshot when a peek interrupts a pending keyboard selection', () => {
    jest.useFakeTimers();
    try {
      const { panel, queryRunner, requests, result } = setupPreview();
      const preview = startQueryPreview(panel, 'A', optionOne)!;
      const first = result(11);
      requests[0].setState({ data: first });
      preview.select(optionTwo, { debounce: true });
      preview.peek(optionThree);
      requests[1].setState({ data: result(13) });
      preview.stopPeek();
      expect(queryRunner.state.data).toBe(first);
      expect(requests).toHaveLength(3);
      const second = result(12);
      requests[2].setState({ data: second });
      expect(queryRunner.state.data).toBe(second);
      preview.dispose();
    } finally {
      jest.useRealTimers();
    }
  });

  it('limits consecutive uncached peeks to the selected clone plus one and cancels the peek on release', () => {
    const { baselineData, panel, queryRunner, requests, result } = setupPreview();
    const preview = startQueryPreview(panel, 'A', optionOne)!;
    preview.peek(optionTwo);
    preview.peek(optionThree);
    expect(panel.state.$behaviors).toEqual([requests[0], requests[2]]);
    requests[1].setState({ data: result(12) });
    expect(queryRunner.state.data).toBe(baselineData);
    preview.stopPeek();
    expect(panel.state.$behaviors).toEqual([requests[0]]);
    expect(requests).toHaveLength(3);
    requests[2].setState({ data: result(13) });
    expect(queryRunner.state.data).toBe(baselineData);
    const selected = result(11);
    requests[0].setState({ data: selected });
    expect(queryRunner.state.data).toBe(selected);
    preview.dispose();
    expect(panel.state.$behaviors).toHaveLength(0);
  });

  it('cancels a switched-away clone and caches its late result without projecting it', () => {
    const { baselineData, panel, queryRunner, requests, result } = setupPreview();
    const preview = startQueryPreview(panel, 'A', optionOne)!;
    const firstRunner = requests[0];
    const cancelled = jest.mocked(firstRunner.cancelQuery).mock.calls.length;
    preview.select(optionTwo);
    expect(jest.mocked(firstRunner.cancelQuery).mock.calls.length).toBe(cancelled + 1);
    expect(panel.state.$behaviors).toEqual([requests[1]]);
    const late = result(11);
    firstRunner.setState({ data: late });
    expect(queryRunner.state.data).toBe(baselineData);
    preview.select(optionOne);
    expect(queryRunner.state.data).toBe(late);
    expect(requests).toHaveLength(2);
    preview.dispose();
  });

  it('re-runs Original when the Baseline snapshot was Loading', () => {
    const { panel, requestedQueries } = setupPreview(LoadingState.Loading);
    const preview = startQueryPreview(panel, 'A', optionOne)!;
    preview.select(queryA);
    expect(requestedQueries).toEqual([
      [optionOne, queryB],
      [queryA, queryB],
    ]);
    preview.dispose();
  });

  it('does not cache a cancellation frame or let a superseded run replace the selected result', () => {
    const { panel, queryRunner, requests, result } = setupPreview();
    const preview = startQueryPreview(panel, 'A', optionOne)!;
    const cancelled = requests[0];
    preview.select(optionTwo);
    preview.select(optionOne);
    expect(requests).toHaveLength(3);
    const selected = result(13);
    requests[2].setState({ data: selected });
    cancelled.setState({ data: result(11) });
    preview.select(queryA);
    preview.select(optionOne);
    expect(queryRunner.state.data).toBe(selected);
    expect(requests).toHaveLength(3);
    preview.dispose();
  });

  it('publishes full selected data, including errors and cached Original, without publishing retired results', () => {
    const { baselineData, panel, requests, result } = setupPreview();
    const preview = startQueryPreview(panel, 'A', optionOne)!;
    const selectedData = jest.fn();
    preview.subscribeToData(selectedData);
    const first = result(11);
    requests[0].setState({ data: first });
    expect(selectedData).toHaveBeenLastCalledWith(first);
    preview.select(optionTwo);
    const error: PanelData = {
      ...result(12),
      state: LoadingState.Error,
      errors: [{ message: 'Invalid query', refId: 'A' }],
    };
    requests[1].setState({ data: error });
    expect(preview.data).toBe(error);
    const count = selectedData.mock.calls.length;
    requests[0].setState({ data: result(13) });
    expect(selectedData).toHaveBeenCalledTimes(count);
    preview.select(queryA);
    expect(selectedData).toHaveBeenLastCalledWith(baselineData);
    preview.dispose();
  });

  it('starts only the last keyboard selection after the debounce and cancels a pending start on Original', () => {
    jest.useFakeTimers();
    try {
      const { baselineData, panel, queryRunner, requests, requestedQueries } = setupPreview();
      const preview = startQueryPreview(panel, 'A', optionOne)!;
      preview.select(optionTwo, { debounce: true });
      preview.select(optionThree, { debounce: true });
      preview.select(optionTwo, { debounce: true });
      jest.advanceTimersByTime(149);
      expect(requests).toHaveLength(1);
      jest.advanceTimersByTime(1);
      expect(requestedQueries).toEqual([
        [optionOne, queryB],
        [optionTwo, queryB],
      ]);
      preview.select(optionThree, { debounce: true });
      preview.select(queryA);
      jest.advanceTimersByTime(200);
      expect(requests).toHaveLength(2);
      expect(queryRunner.state.data).toBe(baselineData);
      preview.dispose();
    } finally {
      jest.useRealTimers();
    }
  });

  it('invalidates option and Original caches when the time range changes', () => {
    const { panel, requests, result, timeRange } = setupPreview();
    const preview = startQueryPreview(panel, 'A', optionOne)!;
    requests[0].setState({ data: result(11) });
    preview.select(queryA);
    timeRange.onTimeRangeChange(
      new SceneTimeRange({ from: '2026-10-07T02:00:00Z', to: '2026-10-07T03:00:00Z' }).state.value
    );
    preview.select(optionOne);
    expect(requests).toHaveLength(2);
    expect(requests[1].state.queries).toEqual([optionOne, queryB]);
    preview.select(queryA);
    expect(requests).toHaveLength(3);
    expect(requests[2].state.queries).toEqual([queryA, queryB]);
    preview.dispose();
  });

  it.each(['switch', 'dispose'])(
    'prevents a retired clone from starting after delayed datasource resolution on %s',
    async (action) => {
      jest.mocked(SceneQueryRunner.prototype.runQueries).mockRestore();
      jest.mocked(SceneQueryRunner.prototype.cancelQuery).mockRestore();
      const datasource = getMockDataSource();
      let resolveDatasource: ((value: typeof datasource) => void) | undefined;
      mockGetDataSource.mockReturnValue(
        new Promise<typeof datasource>((resolve) => {
          resolveDatasource = resolve;
        })
      );
      const networkRequests: DataQueryRequest[] = [];
      setRunRequest((_datasource, request) => {
        if (request.targets.length === 0) {
          return of({ state: LoadingState.Done, series: [], timeRange: request.range, request });
        }
        networkRequests.push(request);
        return NEVER;
      });
      const queryRunner = new SceneQueryRunner({ queries: [queryA, queryB] });
      const panel = new VizPanel({ key: 'panel-1', $data: queryRunner });
      const preview = startQueryPreview(panel, 'A', optionOne)!;
      if (action === 'switch') {
        preview.select(optionTwo);
      } else {
        preview.dispose();
      }
      resolveDatasource?.(datasource);
      await new Promise((resolve) => setTimeout(resolve, 0));
      const requestedSources = () =>
        networkRequests.map((request) =>
          request.targets.map((query) => ('expr' in query && typeof query.expr === 'string' ? query.expr : query.refId))
        );
      expect(requestedSources()).toEqual(action === 'switch' ? [['sum(increase(http_requests_total[5m]))', 'B']] : []);
      if (action === 'switch') {
        preview.select(optionOne);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(requestedSources()).toEqual([
          ['sum(increase(http_requests_total[5m]))', 'B'],
          ['increase(http_requests_total[5m])', 'B'],
        ]);
      }
      preview.dispose();
    }
  );

  beforeEach(() => {
    jest.spyOn(SceneQueryRunner.prototype, 'runQueries').mockImplementation();
    jest.spyOn(SceneQueryRunner.prototype, 'cancelQuery').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs the proposal through a temporary runner without changing canonical queries', () => {
    const queryRunner = new SceneQueryRunner({ queries: [queryA, queryB] });
    const panel = new VizPanel({ key: 'panel-1', $data: queryRunner });

    const preview = startQueryPreview(panel, 'A', proposedQuery);
    const previewRunner = panel.state.$behaviors?.find(
      (behavior): behavior is SceneQueryRunner => behavior instanceof SceneQueryRunner
    );

    expect(preview).toBeDefined();
    expect(queryRunner.state.queries).toEqual([queryA, queryB]);
    expect(previewRunner?.state.queries).toEqual([proposedQuery, queryB]);
    expect(previewRunner?.state.runQueriesMode).toBe('manual');
    expect(previewRunner?.parent).toBe(panel);
    expect(queryRunner.cancelQuery).toHaveBeenCalledTimes(1);
    expect(previewRunner?.runQueries).toHaveBeenCalledTimes(1);
  });

  it('finds a query runner through nested data transformers', () => {
    const queryRunner = new SceneQueryRunner({ queries: [queryA] });
    const panel = new VizPanel({
      key: 'panel-1',
      $data: new SceneDataTransformer({
        $data: new SceneDataTransformer({ $data: queryRunner, transformations: [] }),
        transformations: [],
      }),
    });

    const preview = startQueryPreview(panel, 'A', proposedQuery);
    const previewRunner = panel.state.$behaviors?.find(
      (behavior): behavior is SceneQueryRunner => behavior instanceof SceneQueryRunner
    );

    expect(preview).toBeDefined();
    expect(previewRunner?.state.queries).toEqual([proposedQuery]);

    preview?.dispose();
  });

  it('projects preview data and detaches the temporary runner on dispose', () => {
    const queryRunner = new SceneQueryRunner({ queries: [queryA, queryB] });
    const panel = new VizPanel({ key: 'panel-1', $data: queryRunner });
    const baselineData: PanelData = { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() };
    queryRunner.setState({ data: baselineData });
    const preview = startQueryPreview(panel, 'A', proposedQuery)!;
    const previewRunner = panel.state.$behaviors?.find(
      (behavior): behavior is SceneQueryRunner => behavior instanceof SceneQueryRunner
    )!;
    const previewData: PanelData = { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() };
    const previewStateListener = jest.fn();

    preview.subscribeToState(previewStateListener);

    previewRunner.setState({ data: previewData });

    expect(queryRunner.state.data).toBe(previewData);
    expect(previewStateListener).toHaveBeenCalledWith(LoadingState.Done);

    const cancelCallsBeforeDispose = jest.mocked(previewRunner.cancelQuery).mock.calls.length;
    preview.dispose();
    preview.dispose();

    expect(panel.state.$behaviors).not.toContain(previewRunner);
    expect(previewRunner.parent).toBeUndefined();
    expect(queryRunner.state.data).toBe(baselineData);
    expect(previewRunner.cancelQuery).toHaveBeenCalledTimes(cancelCallsBeforeDispose + 1);
  });

  it('replays preview state when data arrives before subscription', () => {
    const queryRunner = new SceneQueryRunner({ queries: [queryA] });
    const panel = new VizPanel({ key: 'panel-1', $data: queryRunner });
    const preview = startQueryPreview(panel, 'A', proposedQuery)!;
    const previewRunner = panel.state.$behaviors?.find(
      (behavior): behavior is SceneQueryRunner => behavior instanceof SceneQueryRunner
    )!;
    const previewData: PanelData = { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() };
    const previewStateListener = jest.fn();

    previewRunner.setState({ data: previewData });
    preview.subscribeToState(previewStateListener);

    expect(previewStateListener).toHaveBeenCalledWith(LoadingState.Done);
  });

  it('disposes before a canonical query change can run and preserves the newer result', () => {
    const queryRunner = new SceneQueryRunner({ queries: [queryA, queryB] });
    const panel = new VizPanel({ key: 'panel-1', $data: queryRunner });
    const baselineData: PanelData = { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() };
    const previewData: PanelData = { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() };
    const canonicalData: PanelData = { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() };
    queryRunner.setState({ data: baselineData });
    const preview = startQueryPreview(panel, 'A', proposedQuery)!;
    const previewRunner = panel.state.$behaviors?.find(
      (behavior): behavior is SceneQueryRunner => behavior instanceof SceneQueryRunner
    )!;

    previewRunner.setState({ data: previewData });
    expect(queryRunner.state.data).toBe(previewData);

    queryRunner.setState({ queries: [{ ...queryA, hide: true }, queryB] });
    queryRunner.setState({ data: canonicalData });
    preview.dispose();
    previewRunner.setState({ data: previewData });

    expect(panel.state.$behaviors).not.toContain(previewRunner);
    expect(queryRunner.state.data).toBe(canonicalData);
  });

  it('keeps the preview when the canonical query is replaced by an equal clone', () => {
    const queryRunner = new SceneQueryRunner({ queries: [queryA, queryB] });
    const panel = new VizPanel({ key: 'panel-1', $data: queryRunner });
    const preview = startQueryPreview(panel, 'A', proposedQuery)!;
    const previewRunner = panel.state.$behaviors?.find(
      (behavior): behavior is SceneQueryRunner => behavior instanceof SceneQueryRunner
    )!;

    queryRunner.setState({ queries: [{ ...queryA }, queryB] });

    expect(panel.state.$behaviors).toContain(previewRunner);
    expect(previewRunner.parent).toBe(panel);
    preview.dispose();
  });

  it('disposes when a sibling canonical query changes', () => {
    const queryRunner = new SceneQueryRunner({ queries: [queryA, queryB] });
    const panel = new VizPanel({ key: 'panel-1', $data: queryRunner });
    startQueryPreview(panel, 'A', proposedQuery)!;
    const previewRunner = panel.state.$behaviors?.find(
      (behavior): behavior is SceneQueryRunner => behavior instanceof SceneQueryRunner
    )!;

    queryRunner.setState({ queries: [queryA, { ...queryB, hide: true }] });

    expect(panel.state.$behaviors).not.toContain(previewRunner);
    expect(previewRunner.parent).toBeUndefined();
  });

  it('rejects a proposal for a query outside the canonical runner', () => {
    const queryRunner = new SceneQueryRunner({ queries: [queryA] });
    const panel = new VizPanel({ key: 'panel-1', $data: queryRunner });

    expect(startQueryPreview(panel, 'B', proposedQuery)).toBeUndefined();
    expect(panel.state.$behaviors).toBeUndefined();
    expect(queryRunner.cancelQuery).not.toHaveBeenCalled();
  });
});
