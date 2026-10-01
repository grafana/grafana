import { SceneDataTransformer, type SceneObject, SceneQueryRunner } from '@grafana/scenes';

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
