import { SceneDataTransformer, type SceneObject, SceneQueryRunner } from '@grafana/scenes';

// Kept local to the sharing feature rather than imported from dashboard-scene/utils/utils: that
// module transitively reaches DashboardScene, which imports ShareDrawer, creating an import cycle.
export function getQueryRunnerFor(sceneObject: SceneObject | undefined): SceneQueryRunner | undefined {
  if (!sceneObject) {
    return undefined;
  }
  const dataProvider = sceneObject.state.$data ?? sceneObject.parent?.state.$data;
  if (dataProvider instanceof SceneQueryRunner) {
    return dataProvider;
  }
  if (dataProvider instanceof SceneDataTransformer) {
    return getQueryRunnerFor(dataProvider);
  }
  return undefined;
}
