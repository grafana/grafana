import { sceneGraph, SceneDataTransformer, SceneQueryRunner, VizPanel, type SceneObject } from '@grafana/scenes';

// Data sources whose queries are affected by scope filters.
const SCOPE_FILTERED_DATASOURCE_TYPES = ['loki', 'prometheus'];

function getQueryRunnerFor(sceneObject: SceneObject | undefined): SceneQueryRunner | undefined {
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

/**
 * Whether any panel query under `scene` targets a datasource type that scope filters apply to
 * (Loki or Prometheus), including each individual query inside a mixed-datasource panel (a mixed
 * panel's own datasource type is 'mixed', so it's the per-query type that matters there).
 */
export function hasScopeFilteredDatasource(scene: SceneObject): boolean {
  const vizPanels = sceneGraph.findAllObjects(scene, (o) => o instanceof VizPanel);

  return vizPanels.some((obj) => {
    const runner = obj instanceof VizPanel ? getQueryRunnerFor(obj) : undefined;
    if (!runner) {
      return false;
    }

    return runner.state.queries.some((query) => {
      const type = query.datasource?.type ?? runner.state.datasource?.type;
      return type !== undefined && SCOPE_FILTERED_DATASOURCE_TYPES.includes(type);
    });
  });
}
