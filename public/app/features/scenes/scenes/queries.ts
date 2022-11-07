import { SceneQueryRunner } from '../querying/SceneQueryRunner';

export function getQueryRunnerWithRandomWalkQuery() {
  return new SceneQueryRunner({
    queries: [
      {
        refId: 'A',
        datasource: {
          uid: 'gdev-testdata',
          type: 'testdata',
        },
        scenarioId: 'random_walk',
      },
    ],
  });
}
