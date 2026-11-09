import { isEqual } from 'lodash';

import { getDefaultTimeRange, LoadingState, type TimeRange } from '@grafana/data';
import { type QueryRunnerState, type SceneDataQuery, type SceneQueryRunner } from '@grafana/scenes';
import { createDefaultQuery } from 'app/features/query/state/queryDefaults';

export function getEmptyQueryRunnerState(
  timeRange: TimeRange = getDefaultTimeRange()
): Pick<QueryRunnerState, 'queries' | '_hasFetchedData' | 'data'> {
  return {
    queries: [],
    _hasFetchedData: true,
    data: { series: [], state: LoadingState.Done, timeRange },
  };
}

export function setQueryRunnerQueries(
  queryRunner: SceneQueryRunner,
  queries: SceneDataQuery[],
  stateUpdate: Partial<QueryRunnerState> = {}
) {
  if (queries.length === 0) {
    queryRunner.cancelQuery();
    queryRunner.setState({ ...stateUpdate, ...getEmptyQueryRunnerState(queryRunner.state.data?.timeRange) });
    return;
  }

  const isFirstQuery = queryRunner.state.queries.length === 0 && queries.length > 0;
  queryRunner.setState({ ...stateUpdate, queries, ...(isFirstQuery && { _hasFetchedData: false }) });
}

export function isDefaultQuery(query: SceneDataQuery): boolean {
  return isEqual(query, createDefaultQuery());
}
