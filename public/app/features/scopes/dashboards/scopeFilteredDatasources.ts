import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { sceneGraph, VizPanel, type SceneObject } from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/getQueryRunnerFor';

// Data sources whose queries are affected by scope filters.
const SCOPE_FILTERED_DATASOURCE_TYPES = ['loki', 'prometheus'];

// Resolves a ref to its real datasource type, rather than trusting whatever `type` happens to
// already be on it: a ref with no uid/type falls back to the user's default datasource (which
// scope filters still apply to), and a uid-only ref (e.g. a mixed-panel query, or a datasource
// template variable) resolves to its actual type instead of a placeholder like 'mixed'.
async function resolveDatasourceType(ref: DataSourceRef | null | undefined): Promise<string | undefined> {
  const settings = await getDataSourceInstanceSettings(ref ?? null);
  return settings?.type;
}

/**
 * Whether any panel query under `scene` targets a datasource type that scope filters apply to
 * (Loki or Prometheus), including each individual query inside a mixed-datasource panel (a mixed
 * panel's own datasource ref resolves to type 'mixed', so it's the per-query ref that matters there).
 */
export async function hasScopeFilteredDatasource(scene: SceneObject): Promise<boolean> {
  const vizPanels = sceneGraph.findAllObjects(scene, (o) => o instanceof VizPanel);

  for (const obj of vizPanels) {
    const runner = obj instanceof VizPanel ? getQueryRunnerFor(obj) : undefined;
    if (!runner) {
      continue;
    }

    for (const query of runner.state.queries) {
      const type = await resolveDatasourceType(query.datasource ?? runner.state.datasource);
      if (type !== undefined && SCOPE_FILTERED_DATASOURCE_TYPES.includes(type)) {
        return true;
      }
    }
  }

  return false;
}
