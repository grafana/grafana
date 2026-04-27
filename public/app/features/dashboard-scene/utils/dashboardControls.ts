import { filter, Observable, scan, share, type Subscriber } from 'rxjs';

import type { DataSourceApi } from '@grafana/data/types';
import { getDataSourceSrv } from '@grafana/runtime';
import { type SceneVariable } from '@grafana/scenes';
import { type DashboardLink, type DataSourceRef } from '@grafana/schema';
import { type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';

export type DefaultControlEvent =
  | { type: 'variables'; data: VariableKind[] }
  | { type: 'links'; data: DashboardLink[] };

function loadDefaultControlsRaw$(refs: DataSourceRef[]): Observable<DefaultControlEvent> {
  return new Observable((subscriber) => {
    if (refs.length === 0) {
      subscriber.complete();
      return;
    }

    const promises = refs.map((ref) => loadControlsFromRef(ref, subscriber));

    Promise.all(promises).then(() => subscriber.complete());
  });
}

// share() multicasts the raw observable so that loadDefaultVariables$ and
// loadDefaultLinks$ reuse a single subscription — without it, each stream
// would independently load all datasources, doubling the network requests.
export function loadDefaultControlsShared$(refs: DataSourceRef[]) {
  return loadDefaultControlsRaw$(refs).pipe(share());
}

export function loadDefaultVariables$(source$: Observable<DefaultControlEvent>): Observable<VariableKind[]> {
  return source$.pipe(
    filter((e): e is Extract<DefaultControlEvent, { type: 'variables' }> => e.type === 'variables'),
    scan<Extract<DefaultControlEvent, { type: 'variables' }>, VariableKind[]>(
      (acc, event) => [...acc, ...event.data].sort(sortVariables),
      []
    )
  );
}

export function loadDefaultLinks$(source$: Observable<DefaultControlEvent>): Observable<DashboardLink[]> {
  return source$.pipe(
    filter((e): e is Extract<DefaultControlEvent, { type: 'links' }> => e.type === 'links'),
    scan<Extract<DefaultControlEvent, { type: 'links' }>, DashboardLink[]>(
      (acc, event) => [...acc, ...event.data].sort(sortLinks),
      []
    )
  );
}

const collator = new Intl.Collator();

function sortVariables(a: VariableKind, b: VariableKind): number {
  const groupCmp = collator.compare(a.spec.origin?.group ?? '', b.spec.origin?.group ?? '');
  return groupCmp !== 0 ? groupCmp : collator.compare(a.spec.name, b.spec.name);
}

function sortLinks(a: DashboardLink, b: DashboardLink): number {
  const groupCmp = collator.compare(a.origin?.group ?? '', b.origin?.group ?? '');
  return groupCmp !== 0 ? groupCmp : collator.compare(a.title ?? '', b.title ?? '');
}

async function loadControlsFromRef(ref: DataSourceRef, subscriber: Subscriber<DefaultControlEvent>) {
  let ds: DataSourceApi;

  try {
    ds = await getDataSourceSrv().get(ref);
  } catch (e) {
    console.warn('Failed to load datasource', ref, e);
    return;
  }

  await Promise.all([emitDefaultVariables(ds, subscriber), emitDefaultLinks(ds, subscriber)]);
}

async function emitDefaultVariables(ds: DataSourceApi, subscriber: Subscriber<DefaultControlEvent>) {
  if (typeof ds.getDefaultVariables !== 'function') {
    return;
  }

  try {
    const variables = await ds.getDefaultVariables();

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

async function emitDefaultLinks(ds: DataSourceApi, subscriber: Subscriber<DefaultControlEvent>) {
  if (typeof ds.getDefaultLinks !== 'function') {
    return;
  }

  try {
    const links = await ds.getDefaultLinks();

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
