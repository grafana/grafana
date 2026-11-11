import { type DataQueryRequest, getDefaultTimeRange, LoadingState } from '@grafana/data';
import { SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { clearDefaultQuery } from './clearDefaultQuery';
import { getEmptyQueryRunnerState, setQueryRunnerQueries } from './queryRunnerState';

describe('query runner defaults', () => {
  it('marks an intentionally empty runner ready to display', () => {
    const timeRange = getDefaultTimeRange();

    expect(getEmptyQueryRunnerState({ series: [], state: LoadingState.Loading, timeRange })).toEqual({
      queries: [],
      _hasFetchedData: true,
      data: { series: [], state: LoadingState.Done, timeRange, request: undefined },
    });
  });

  it('preserves request metadata when clearing the runner', () => {
    const timeRange = getDefaultTimeRange();
    const request = {} as DataQueryRequest;

    expect(
      getEmptyQueryRunnerState({ series: [], state: LoadingState.Loading, timeRange, request }).data?.request
    ).toBe(request);
  });

  it('clears only the untouched starter query', () => {
    const runner = new SceneQueryRunner({ queries: [{ refId: 'A' }] });
    const panel = new VizPanel({ pluginId: 'custom', $data: runner });

    clearDefaultQuery(panel);

    expect(runner.state.queries).toEqual([]);
    expect(runner.isDataReadyToDisplay()).toBe(true);
  });

  it('preserves an empty query with a selected datasource', () => {
    const runner = new SceneQueryRunner({
      queries: [{ refId: 'A', datasource: { uid: 'test', type: 'testdata' }, hide: false }],
    });
    clearDefaultQuery(new VizPanel({ pluginId: 'custom', $data: runner }));
    expect(runner.state.queries).toEqual([{ refId: 'A', datasource: { uid: 'test', type: 'testdata' }, hide: false }]);
  });

  it.each([true, false])('preserves a query with hide=%s', (hide) => {
    const runner = new SceneQueryRunner({ queries: [{ refId: 'A', hide }] });
    const panel = new VizPanel({ pluginId: 'custom', $data: runner });

    clearDefaultQuery(panel);

    expect(runner.state.queries).toEqual([{ refId: 'A', hide }]);
  });

  it('cancels the starter query and replaces its data with an empty result', () => {
    const timeRange = getDefaultTimeRange();
    const runner = new SceneQueryRunner({
      queries: [{ refId: 'A' }],
      data: { series: [], state: LoadingState.Done, timeRange },
    });
    const cancelQuery = jest.spyOn(runner, 'cancelQuery');
    const panel = new VizPanel({ pluginId: 'custom', $data: runner });

    clearDefaultQuery(panel);

    expect(cancelQuery).toHaveBeenCalledTimes(1);
    expect(runner.state.data).toEqual({
      series: [],
      state: LoadingState.Done,
      timeRange,
    });
  });

  it('waits for data again when the first explicit query is added', () => {
    const timeRange = getDefaultTimeRange();
    const request = {} as DataQueryRequest;
    const runner = new SceneQueryRunner(
      getEmptyQueryRunnerState({ series: [], state: LoadingState.Done, timeRange, request })
    );

    setQueryRunnerQueries(runner, [{ refId: 'A', expr: 'up' }]);

    expect(runner.state.queries).toEqual([{ refId: 'A', expr: 'up' }]);
    expect(runner.state.data).toEqual({
      series: [],
      state: LoadingState.Loading,
      timeRange,
      request,
    });
    expect(runner.isDataReadyToDisplay()).toBe(false);
  });

  it('preserves readiness when an existing query changes', () => {
    const runner = new SceneQueryRunner({ queries: [{ refId: 'A' }], _hasFetchedData: true });

    setQueryRunnerQueries(runner, [{ refId: 'A', expr: 'up' }]);

    expect(runner.state.queries).toEqual([{ refId: 'A', expr: 'up' }]);
    expect(runner.isDataReadyToDisplay()).toBe(true);
  });

  it('cancels the active query and marks the runner ready when the last query is removed', () => {
    const timeRange = getDefaultTimeRange();
    const runner = new SceneQueryRunner({
      queries: [{ refId: 'A' }],
      _hasFetchedData: false,
      data: { series: [], state: LoadingState.Loading, timeRange },
    });
    const cancelQuery = jest.spyOn(runner, 'cancelQuery');

    setQueryRunnerQueries(runner, []);

    expect(cancelQuery).toHaveBeenCalledTimes(1);
    expect(runner.state.queries).toEqual([]);
    expect(runner.state.data).toEqual({
      series: [],
      state: LoadingState.Done,
      timeRange,
      request: undefined,
    });
    expect(runner.isDataReadyToDisplay()).toBe(true);
  });
});
