import { filter, Observable, scan, share, type Subscriber } from 'rxjs';

import { type DataSourceApi, type DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceInstance, getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
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
  // Default controls are opportunistic; a missing datasource is a skip, not a failure.
  // Ask the settings cache first so plugin-load errors (e.g. "module not found") are
  // not mistaken for a missing datasource. Match getDataSourceInstance's empty-uid
  // normalization so { uid: '', type } is a type-only lookup, not a miss on uid ''.
  //
  // A type-only ref means "any instance of this plugin". Both async APIs fall back to the
  // default datasource when no instance matches; legacy get() rejected, and skipping is what
  // we want — otherwise the default DS's controls get emitted under the wrong type.
  // settings.type may still differ when the instance matched via meta.aliasIDs (legacy
  // plugin ids on DataSourceVariable refs); that is a real instance, not a fallback.
  const settings = await getDataSourceInstanceSettings(settingsLookupRef(ref));
  if (!settings) {
    return;
  }
  if (!ref.uid && ref.type && !matchesRequestedType(settings, ref.type)) {
    return;
  }

  let ds: DataSourceApi;
  try {
    ds = await getDataSourceInstance(ref);
  } catch (e) {
    console.warn('Failed to load datasource', ref, e);
    return;
  }

  await Promise.all([emitDefaultVariables(ds, subscriber), emitDefaultLinks(ds, subscriber)]);
}

function settingsLookupRef(ref: DataSourceRef): DataSourceRef {
  return ref.uid === '' ? { ...ref, uid: undefined } : ref;
}

// Mirrors getDataSourceInstanceSettings type lookup: exact type or aliasIDs match.
function matchesRequestedType(settings: DataSourceInstanceSettings, type: string): boolean {
  return settings.type === type || (settings.meta?.aliasIDs?.includes(type) ?? false);
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
