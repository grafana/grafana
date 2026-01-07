import { TypedVariableModel } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { SceneVariable } from '@grafana/scenes';
import { DashboardLink, DataSourceRef, VariableHide } from '@grafana/schema';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { DashboardDTO } from 'app/types/dashboard';

import { getRuntimePanelDataSource } from '../serialization/layoutSerializers/utils';

export const loadDatasources = (refs: DataSourceRef[]) => {
  return Promise.all(refs.map((ref) => getDataSourceSrv().get(ref)));
};

// Deduplicates datasource refs by type, keeping only one ref per datasource plugin type
export const deduplicateDatasourceRefsByType = (refs: Array<DataSourceRef | null | undefined>): DataSourceRef[] => {
  const dsByType: Record<string, DataSourceRef> = {};

  for (const ref of refs) {
    if (ref && ref.type && !dsByType[ref.type]) {
      dsByType[ref.type] = ref;
    }
  }

  return Object.values(dsByType);
};

export const loadDefaultControlsFromDatasources = async (refs: DataSourceRef[]) => {
  const datasources = await loadDatasources(refs);
  const defaultVariables: TypedVariableModel[] = [];
  const defaultLinks: DashboardLink[] = [];

  // Default variables
  for (const ds of datasources) {
    if (ds.getDefaultVariables) {
      const dsVariables = ds.getDefaultVariables();
      if (dsVariables && dsVariables.length) {
        defaultVariables.push(
          ...dsVariables.map((v) => ({
            ...v,
            // Putting under the dashbaord controls menu by default
            hide: VariableHide.inControlsMenu,
            source: {
              uid: ds.uid,
              sourceId: ds.type,
              sourceType: 'datasource',
            },
          }))
        );
      }
    }

    // Default links
    if (ds.getDefaultLinks) {
      const dsLinks = ds.getDefaultLinks();
      if (dsLinks && dsLinks.length) {
        defaultLinks.push(
          ...dsLinks.map((l) => ({
            ...l,
            isDefault: true,
            parentDatasourceRef: ds.getRef(),
            // Putting under the dashboard-controls menu by default
            placement: 'inControlsMenu' as const,
            source: {
              uid: ds.uid,
              sourceId: ds.type,
              sourceType: 'datasource',
            },
          }))
        );
      }
    }
  }

  return { defaultVariables, defaultLinks };
};

export const getDsRefsFromV1Dashboard = (rsp: DashboardDTO) => {
  const dashboardModel = new DashboardModel(rsp.dashboard, rsp.meta);

  // Datasources from panels
  const datasourceRefs = dashboardModel.panels
    .filter((panel) => panel.type !== 'row')
    .map((panel): DataSourceRef | null | undefined =>
      panel.datasource
        ? panel.datasource
        : panel.targets?.find((t) => t.datasource !== null && t.datasource !== undefined)?.datasource
    )
    .filter((ref) => ref !== null && ref !== undefined);

  // Datasources from variables
  if (dashboardModel.templating?.list) {
    for (const variable of dashboardModel.templating.list) {
      if (variable.type === 'query' && variable.datasource) {
        datasourceRefs.push(variable.datasource);
      } else if (variable.type === 'datasource' && variable.query) {
        datasourceRefs.push({ type: variable.query });
      }
    }
  }

  return deduplicateDatasourceRefsByType(datasourceRefs);
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

const sortByProp = <T>(items: T[], propGetter: (item: T) => Object | undefined) => {
  return items.sort((a, b) => {
    const aProp = propGetter(a) ?? false;
    const bProp = propGetter(b) ?? false;

    if (aProp && !bProp) {
      return -1;
    }

    if (!aProp && bProp) {
      return 1;
    }

    return 0;
  });
};

export const sortDefaultVarsFirst = (items: SceneVariable[]) => sortByProp(items, (item) => item.state.source);
export const sortDefaultLinksFirst = (items: DashboardLink[]) => sortByProp(items, (item) => item.source);
