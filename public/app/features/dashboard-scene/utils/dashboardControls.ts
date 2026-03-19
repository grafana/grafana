import { nanoid } from 'nanoid';
import { Observable, Subscriber } from 'rxjs';

import { DataSourceApi } from '@grafana/data';
import { getDataSourceSrv, reportInteraction } from '@grafana/runtime';
import { SceneVariable } from '@grafana/scenes';
import { DashboardLink, DataSourceRef } from '@grafana/schema';
import { VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

type LoadDefaultControlsPhase = 'default_variables' | 'default_links';
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

export type DefaultControlEvent =
  | { type: 'variables'; data: VariableKind[] }
  | { type: 'links'; data: DashboardLink[] };

export function loadDefaultControls$(refs: DataSourceRef[]): Observable<DefaultControlEvent> {
  return new Observable((subscriber) => {
    if (refs.length === 0) {
      subscriber.complete();
      return;
    }

    const traceId = nanoid(8);
    const promises = refs.map((ref) => loadControlsFromRef(ref, traceId, subscriber));

    Promise.all(promises).then(() => subscriber.complete());
  });
}

async function loadControlsFromRef(ref: DataSourceRef, traceId: string, subscriber: Subscriber<DefaultControlEvent>) {
  let ds: DataSourceApi;

  try {
    ds = await getDataSourceSrv().get(ref);
  } catch (e) {
    console.warn('Failed to load datasource', ref, e);
    return;
  }

  await Promise.all([emitDefaultVariables(ds, traceId, subscriber), emitDefaultLinks(ds, traceId, subscriber)]);
}

async function emitDefaultVariables(ds: DataSourceApi, traceId: string, subscriber: Subscriber<DefaultControlEvent>) {
  if (typeof ds.getDefaultVariables !== 'function') {
    return;
  }

  try {
    const variables = await invokeAndTrack(ds.getDefaultVariables.bind(ds), {
      traceId,
      phase: 'default_variables',
      datasourceType: ds.type,
    });

    if (variables?.length) {
      const sanitizedType = ds.type.replace(/\W/g, '_');
      const data: VariableKind[] = variables.map((v) => {
        const copy = { ...v };
        copy.spec = {
          ...v.spec,
          name: `${sanitizedType}_${v.spec.name}`,
          label: v.spec.label || v.spec.name,
          origin: { type: 'datasource' as const, group: ds.type },
        };
        return copy;
      });
      subscriber.next({ type: 'variables', data });
    }
  } catch (e) {
    console.warn('Failed to load default variables from datasource', ds.type, e);
  }
}

async function emitDefaultLinks(ds: DataSourceApi, traceId: string, subscriber: Subscriber<DefaultControlEvent>) {
  if (typeof ds.getDefaultLinks !== 'function') {
    return;
  }

  try {
    const links = await invokeAndTrack(ds.getDefaultLinks.bind(ds), {
      traceId,
      phase: 'default_links',
      datasourceType: ds.type,
    });

    if (links?.length) {
      subscriber.next({
        type: 'links',
        data: links.map((l) => ({
          ...l,
          origin: { type: 'datasource' as const, group: ds.type },
        })),
      });
    }
  } catch (e) {
    console.warn('Failed to load default links from datasource', ds.type, e);
  }
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
