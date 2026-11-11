import { isEqual, omit } from 'lodash';

import { getDefaultTimeRange, LoadingState, type PanelData } from '@grafana/data';
import { type QueryRunnerState, type SceneDataQuery, type SceneQueryRunner } from '@grafana/scenes';
import { createDefaultQuery } from 'app/features/query/state/queryDefaults';

export function getEmptyQueryRunnerState(
  previousData?: PanelData
): Pick<QueryRunnerState, 'queries' | '_hasFetchedData' | 'data'> {
  return {
    queries: [],
    _hasFetchedData: true,
    data: {
      series: [],
      state: LoadingState.Done,
      timeRange: previousData?.timeRange ?? getDefaultTimeRange(),
      request: previousData?.request,
    },
  };
}

export function setQueryRunnerQueries(
  queryRunner: SceneQueryRunner,
  queries: SceneDataQuery[],
  stateUpdate: Partial<QueryRunnerState> = {}
) {
  if (queries.length === 0) {
    queryRunner.cancelQuery();
    queryRunner.setState({ ...stateUpdate, ...getEmptyQueryRunnerState(queryRunner.state.data) });
    return;
  }

  const isFirstQuery = queryRunner.state.queries.length === 0 && queries.length > 0;
  const previousData = queryRunner.state.data;
  queryRunner.setState({
    ...stateUpdate,
    queries,
    ...(isFirstQuery && {
      _hasFetchedData: false,
      data: {
        series: [],
        state: LoadingState.Loading,
        timeRange: previousData?.timeRange ?? getDefaultTimeRange(),
        request: previousData?.request,
      },
    }),
  });
}

export function isDefaultQuery(query: SceneDataQuery): boolean {
  return isEqual(omit(query, ['hide']), createDefaultQuery());
}
