import { QueryRunnerState, SceneQueryRunner } from '@grafana/scenes';
import { TestDataQuery } from 'app/plugins/datasource/testdata/types';

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
