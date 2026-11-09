import { isEqual } from 'lodash';

import { type QueryRunnerState, type SceneDataQuery, type SceneQueryRunner } from '@grafana/scenes';
import { createDefaultQuery } from 'app/features/query/state/queryDefaults';

export function getEmptyQueryRunnerState(): Pick<QueryRunnerState, 'queries' | '_hasFetchedData'> {
  return { queries: [], _hasFetchedData: true };
}

export function setQueryRunnerQueries(queryRunner: SceneQueryRunner, queries: SceneDataQuery[]) {
  const isFirstQuery = queryRunner.state.queries.length === 0 && queries.length > 0;
  queryRunner.setState({ queries, ...(isFirstQuery && { _hasFetchedData: false }) });
}

export function isDefaultQuery(query: SceneDataQuery): boolean {
  return isEqual(query, createDefaultQuery());
}
