import { TestDataQuery } from 'app/plugins/datasource/testdata/types';

import { QueryRunnerState, SceneQueryRunner } from '../querying/SceneQueryRunner';

export function getQueryRunnerWithRandomWalkQuery(
  overrides?: Partial<TestDataQuery>,
  queryRunnerOverrides?: Partial<QueryRunnerState>
) {
  return new SceneQueryRunner({
    queries: [
      {
        refId: 'A',
        datasource: {
          uid: 'gdev-testdata',
          type: 'testdata',
        },
        scenarioId: 'random_walk',
        ...overrides,
      },
    ],
    ...queryRunnerOverrides,
  });
}
