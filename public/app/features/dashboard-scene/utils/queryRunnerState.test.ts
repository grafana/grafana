import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { clearDefaultQuery } from './clearDefaultQuery';
import { getEmptyQueryRunnerState, setQueryRunnerQueries } from './queryRunnerState';

describe('query runner defaults', () => {
  it('marks an intentionally empty runner ready to display', () => {
    expect(getEmptyQueryRunnerState()).toEqual({ queries: [], _hasFetchedData: true });
  });

  it('clears only the untouched starter query', () => {
    const runner = new SceneQueryRunner({ queries: [{ refId: 'A' }] });
    const panel = new VizPanel({ pluginId: 'custom', $data: runner });

    clearDefaultQuery(panel);

    expect(runner.state.queries).toEqual([]);
    expect(runner.isDataReadyToDisplay()).toBe(true);
  });

  it('preserves a configured query', () => {
    const runner = new SceneQueryRunner({ queries: [{ refId: 'A', hide: true }] });
    const panel = new VizPanel({ pluginId: 'custom', $data: runner });

    clearDefaultQuery(panel);

    expect(runner.state.queries).toEqual([{ refId: 'A', hide: true }]);
  });

  it('cancels the starter query and clears its data', () => {
    const runner = new SceneQueryRunner({
      queries: [{ refId: 'A' }],
      data: { series: [], state: LoadingState.Done, timeRange: getDefaultTimeRange() },
    });
    const cancelQuery = jest.spyOn(runner, 'cancelQuery');
    const panel = new VizPanel({ pluginId: 'custom', $data: runner });

    clearDefaultQuery(panel);

    expect(cancelQuery).toHaveBeenCalledTimes(1);
    expect(runner.state.data).toBeUndefined();
  });

  it('waits for data again when the first explicit query is added', () => {
    const runner = new SceneQueryRunner(getEmptyQueryRunnerState());

    setQueryRunnerQueries(runner, [{ refId: 'A', expr: 'up' }]);

    expect(runner.state.queries).toEqual([{ refId: 'A', expr: 'up' }]);
    expect(runner.isDataReadyToDisplay()).toBe(false);
  });

  it('preserves readiness when an existing query changes', () => {
    const runner = new SceneQueryRunner({ queries: [{ refId: 'A' }], _hasFetchedData: true });

    setQueryRunnerQueries(runner, [{ refId: 'A', expr: 'up' }]);

    expect(runner.state.queries).toEqual([{ refId: 'A', expr: 'up' }]);
    expect(runner.isDataReadyToDisplay()).toBe(true);
  });

  it('cancels the active query and marks the runner ready when the last query is removed', () => {
    const runner = new SceneQueryRunner({
      queries: [{ refId: 'A' }],
      _hasFetchedData: false,
      data: { series: [], state: LoadingState.Loading, timeRange: getDefaultTimeRange() },
    });
    const cancelQuery = jest.spyOn(runner, 'cancelQuery');

    setQueryRunnerQueries(runner, []);

    expect(cancelQuery).toHaveBeenCalledTimes(1);
    expect(runner.state.queries).toEqual([]);
    expect(runner.state.data).toBeUndefined();
    expect(runner.isDataReadyToDisplay()).toBe(true);
  });
});
