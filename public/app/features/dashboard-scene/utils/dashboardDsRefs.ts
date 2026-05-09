import { DataSourceVariable, QueryVariable, sceneGraph } from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';

import { type DashboardScene } from '../scene/DashboardScene';

import { dashboardSceneGraph } from './dashboardSceneGraph';
import { getDatasourceFromQueryRunner } from './getDatasourceFromQueryRunner';
import { getQueryRunnerFor } from './utils';

function deduplicateDatasourceRefsByType(refs: Array<DataSourceRef | null | undefined>): DataSourceRef[] {
  const dsByType: Record<string, DataSourceRef> = {};

  for (const ref of refs) {
    if (ref && ref.type && !dsByType[ref.type]) {
      dsByType[ref.type] = ref;
    }
  }

  return Object.values(dsByType);
}

export function getDsRefsFromScene(scene: DashboardScene): DataSourceRef[] {
  const refs: Array<DataSourceRef | null | undefined> = [];

  // Datasources from panels
  for (const panel of dashboardSceneGraph.getVizPanels(scene)) {
    const queryRunner = getQueryRunnerFor(panel);
    if (queryRunner) {
      refs.push(getDatasourceFromQueryRunner(queryRunner));
    }
  }

  // Datasources from variables
  for (const variable of sceneGraph.getVariables(scene).state.variables) {
    if (variable instanceof QueryVariable && variable.state.datasource) {
      refs.push(variable.state.datasource);
    } else if (variable instanceof DataSourceVariable && variable.state.pluginId) {
      refs.push({ type: variable.state.pluginId });
    }
  }

  return deduplicateDatasourceRefsByType(refs);
}
