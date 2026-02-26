import { DataSourceRef } from '@grafana/schema';
import { Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { DashboardDTO } from 'app/types/dashboard';

import { getRuntimePanelDataSource } from '../serialization/layoutSerializers/utils';

function getDatasourceRefFromPanel(panel: {
  datasource?: DataSourceRef | null;
  targets?: Array<{ datasource?: DataSourceRef | null }>;
}): DataSourceRef | null | undefined {
  if (panel.datasource != null) {
    return panel.datasource;
  }
  const targetWithDatasource = panel.targets?.find((t) => t.datasource != null);
  return targetWithDatasource?.datasource;
}

function getDsRefsFromV1Panels(
  panels: Array<{
    type?: string;
    datasource?: DataSourceRef | null;
    targets?: Array<{ datasource?: DataSourceRef | null }>;
  }> = []
): Array<DataSourceRef | null | undefined> {
  const refs: Array<DataSourceRef | null | undefined> = [];
  for (const panel of panels) {
    if (panel.type === 'row') {
      continue;
    }
    const ref = getDatasourceRefFromPanel(panel);
    if (ref != null) {
      refs.push(ref);
    }
  }
  return refs;
}

function getDsRefsFromV1Variables(
  variableList: Array<{
    type?: string;
    datasource?: DataSourceRef | null;
    query?: string | Record<string, unknown>;
  }> = []
): Array<DataSourceRef | null | undefined> {
  const refs: Array<DataSourceRef | null | undefined> = [];
  for (const variable of variableList) {
    if (variable.type === 'query' && variable.datasource) {
      refs.push(variable.datasource);
    } else if (variable.type === 'datasource' && typeof variable.query === 'string') {
      refs.push({ type: variable.query });
    }
  }
  return refs;
}

function deduplicateDatasourceRefsByType(refs: Array<DataSourceRef | null | undefined>): DataSourceRef[] {
  const dsByType: Record<string, DataSourceRef> = {};

  for (const ref of refs) {
    if (ref && ref.type && !dsByType[ref.type]) {
      dsByType[ref.type] = ref;
    }
  }

  return Object.values(dsByType);
}

export const getDsRefsFromV1Dashboard = (rsp: DashboardDTO): DataSourceRef[] => {
  const dashboard = rsp.dashboard;
  const refsFromPanels = getDsRefsFromV1Panels(dashboard.panels);
  const refsFromVariables = getDsRefsFromV1Variables(dashboard.templating?.list);

  return deduplicateDatasourceRefsByType([...refsFromPanels, ...refsFromVariables]);
};

export const getDsRefsFromV2Dashboard = (rsp: DashboardWithAccessInfo<DashboardV2Spec>) => {
  const datasourceRefs: Array<DataSourceRef | null | undefined> = [];

  //Datasources from panels
  if (rsp.spec.elements) {
    for (const element of Object.values(rsp.spec.elements)) {
      if (element.kind === 'Panel') {
        const panel = element;
        if (panel.spec.data?.spec?.queries) {
          for (const query of panel.spec.data.spec.queries) {
            const queryDs = query.spec.query.datasource?.name
              ? { uid: query.spec.query.datasource.name, type: query.spec.query.group }
              : getRuntimePanelDataSource(query.spec.query);

            if (queryDs) {
              datasourceRefs.push(queryDs);
            }
          }
        }
      }
    }
  }

  // Datasources from variables
  if (rsp.spec.variables) {
    for (const variable of rsp.spec.variables) {
      if (variable.kind === 'QueryVariable') {
        const queryVar = variable;
        if (queryVar.spec.query?.datasource?.name) {
          datasourceRefs.push({
            uid: queryVar.spec.query.datasource.name,
            type: queryVar.spec.query.group,
          });
        } else if (queryVar.spec.query?.group) {
          datasourceRefs.push({ type: queryVar.spec.query.group });
        }
      } else if (variable.kind === 'DatasourceVariable') {
        if (variable.spec.pluginId) {
          datasourceRefs.push({ type: variable.spec.pluginId });
        }
      }
    }
  }

  return deduplicateDatasourceRefsByType(datasourceRefs);
};
