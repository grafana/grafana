import { nanoid } from 'nanoid';

import { DataSourceApi } from '@grafana/data';
import { getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { SceneVariable } from '@grafana/scenes';
import { DashboardLink, DataSourceRef } from '@grafana/schema';
import { VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { reportPerformance } from 'app/core/services/echo/EchoSrv';

export function loadDefaultControlsFromDatasources(refs: DataSourceRef[]) {
  if (refs.length === 0) {
    return Promise.resolve({ defaultVariables: [], defaultLinks: [] });
  }

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
