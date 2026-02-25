import { nanoid } from 'nanoid';

import { DataSourceApi } from '@grafana/data';
import { getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { SceneVariable } from '@grafana/scenes';
import { DashboardLink, DataSourceRef } from '@grafana/schema';
import { Spec as DashboardV2Spec, VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { reportPerformance } from 'app/core/services/echo/EchoSrv';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { DashboardDTO } from 'app/types/dashboard';

import { getRuntimePanelDataSource } from '../serialization/layoutSerializers/utils';

export function loadDefaultControlsFromDatasources(refs: DataSourceRef[]) {
  const traceId = nanoid(8);

  return invokeAndTrack(() => loadDefaultControlsByRefs(refs, traceId), {
    traceId,
    phase: 'total',
  });
}

async function loadDefaultControlsByRefs(refs: DataSourceRef[], traceId: string) {
  const totalStart = performance.now();

  const datasources = await invokeAndTrack(() => loadDatasources(refs), {
    traceId,
    phase: 'load_datasources',
  });

  const defaultVariables: VariableKind[] = [];
  const defaultLinks: DashboardLink[] = [];

  for (const ds of datasources) {
    try {
      if (typeof ds.getDefaultVariables === 'function') {
        const dsVariables = await invokeAndTrack(ds.getDefaultVariables.bind(ds), {
          traceId,
          phase: 'default_variables',
          datasourceType: ds.type,
        });

        if (dsVariables && dsVariables.length) {
          defaultVariables.push(
            ...dsVariables.map((v) => {
              const variable = { ...v };
              variable.spec = {
                ...variable.spec,
                origin: {
                  type: 'datasource' as const,
                  group: ds.type,
                },
              };
              return variable;
            })
          );
        }
      }

      if (typeof ds.getDefaultLinks === 'function') {
        const dsLinks = await invokeAndTrack(ds.getDefaultLinks.bind(ds), {
          traceId,
          phase: 'default_links',
          datasourceType: ds.type,
        });

        if (dsLinks && dsLinks.length) {
          defaultLinks.push(
            ...dsLinks.map((l) => {
              return {
                ...l,
                origin: {
                  type: 'datasource' as const,
                  group: ds.type,
                },
              };
            })
          );
        }
      }
    } catch (e) {
      console.warn('Failed to load default controls from datasource', ds.type, e);
    }
  }

  const totalDurationMs = performance.now() - totalStart;
  reportPerformance('dashboards_default_controls_load_total_ms', totalDurationMs);

  return { defaultVariables, defaultLinks };
}

const loadDatasources = async (refs: DataSourceRef[]) => {
  const datasources: DataSourceApi[] = [];

  for (const ref of refs) {
    try {
      const ds = await getDataSourceSrv().get(ref);
      datasources.push(ds);
    } catch (e) {
      console.warn('Failed to load datasource', ref, e);
    }
  }
  return datasources;
};

// Deduplicates datasource refs by type, keeping only one ref per datasource plugin type
const deduplicateDatasourceRefsByType = (refs: Array<DataSourceRef | null | undefined>): DataSourceRef[] => {
  const dsByType: Record<string, DataSourceRef> = {};

  for (const ref of refs) {
    if (ref && ref.type && !dsByType[ref.type]) {
      dsByType[ref.type] = ref;
    }
  }

  return Object.values(dsByType);
};

type LoadDefaultControlsPhase = 'total' | 'load_datasources' | 'default_variables' | 'default_links';
type InvokeAndTrackOptions = { traceId: string; phase: LoadDefaultControlsPhase; datasourceType?: string };

async function invokeAndTrack<T>(action: () => Promise<T>, options: InvokeAndTrackOptions): Promise<T> {
  const start = performance.now();
  const result = await action();

  reportInteraction('dashboards_load_default_controls', {
    ...options,
    duration_ms: Math.round(performance.now() - start),
  });

  return result;
}

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

export const sortDefaultVarsFirst = (items: SceneVariable[]) => sortByProp(items, (item) => item.state.origin);
export const sortDefaultLinksFirst = (items: DashboardLink[]) => sortByProp(items, (item) => item.origin);
