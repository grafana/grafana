import { TestDataQuery } from 'app/plugins/datasource/testdata/types';

import { SceneQueryRunner } from '../querying/SceneQueryRunner';

export function getQueryRunnerWithRandomWalkQuery(overrides?: Partial<TestDataQuery>) {
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
  });
}
