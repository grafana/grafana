import { sceneGraph, type SceneObject, SceneVariableValueChangedEvent, VizPanel } from '@grafana/scenes';

/**
 * VizPanel caches the result of applyFieldOverrides keyed on the raw panel data, so a variable
 * change that only affects fieldConfig (e.g. `$myVar` in threshold steps or min/max) is not
 * re-interpolated until new data arrives. The panel's own variable dependency only triggers a
 * re-render, which then serves the stale cache. This dashboard-level behavior clears the field
 * config cache of any panel whose config depends on the changed variable so the next render
 * re-runs applyFieldOverrides with the new variable value.
 */
export function invalidateFieldConfigCacheOnVariableChange(dashboard: SceneObject): () => void {
  const sub = dashboard.subscribeToEvent(SceneVariableValueChangedEvent, (event) => {
    const variable = event.payload;

    for (const panel of sceneGraph.findAllObjects(dashboard, (obj) => obj instanceof VizPanel)) {
      if (panel instanceof VizPanel && panel.variableDependency?.hasDependencyOn(variable.state.name)) {
        panel.clearFieldConfigCache();
        panel.forceRender();
      }
    }
  });

  return () => sub.unsubscribe();
}
