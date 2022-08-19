export function getQueryRunnerWithRandomWalkQuery() {
  return [
    {
      refId: 'A',
      datasource: {
        uid: 'gdev-testdata',
        type: 'testdata',
      },
      scenarioId: 'random_walk',
    },
  ];
}
