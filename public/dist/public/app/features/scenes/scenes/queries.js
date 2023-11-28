import { SceneQueryRunner } from '@grafana/scenes';
export function getQueryRunnerWithRandomWalkQuery(overrides, queryRunnerOverrides) {
    return new SceneQueryRunner(Object.assign({ queries: [
            Object.assign({ refId: 'A', datasource: {
                    uid: 'gdev-testdata',
                    type: 'testdata',
                }, scenarioId: 'random_walk' }, overrides),
        ] }, queryRunnerOverrides));
}
//# sourceMappingURL=queries.js.map