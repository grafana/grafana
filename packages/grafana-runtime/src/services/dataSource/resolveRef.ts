import { type DataSourceInstanceListItem, type DataSourceRef, type ScopedVars, isObject } from '@grafana/data';

import { getTemplateSrv } from '../templateSrv';

import {
  getDataSourceCacheSource,
  getDefaultListItem,
  getListItemById,
  getListItemByName,
  getListItemByUid,
} from './cache';
import { NUMERIC_ID_REF_WARNING } from './constants';
import { findByType } from './listFilters';
import { logDataSourceWarning } from './logging';

export interface ResolvedRef {
  item: DataSourceInstanceListItem;
  /** The raw template variable string, when the ref was one. */
  templated?: string;
}

/**
 * Resolve a ref against the list layer, with the same coercions as the legacy
 * `DataSourceSrv.getInstanceSettings`: uid, name or numeric id; `'default'` and empty refs;
 * type-only refs; and template variables anywhere in the string. Expression refs are not handled
 * here — they never enter the list layer.
 */
export function resolveRef(
  ref: DataSourceRef | string | null | undefined,
  scopedVars: ScopedVars | undefined
): ResolvedRef | undefined {
  const nameOrUid = getNameOrUid(ref);

  if (nameOrUid == null || nameOrUid === 'default') {
    if (isDataSourceRef(ref) && ref.type) {
      const byType = findByType(ref.type);
      if (byType) {
        return { item: byType };
      }
    }
    const item = getDefaultListItem();
    return item ? { item } : undefined;
  }

  // Template variable reference — interpolate and preserve the raw ref. The variable can sit
  // anywhere in the string (e.g. `logs-${stage}-loki`), not only at the start; legacy
  // DataSourceSrv.get() interpolates unconditionally. When interpolation changes nothing (a
  // datasource name that merely contains `$`), fall through to the plain lookup.
  if (nameOrUid.includes('$')) {
    const interpolated = getTemplateSrv().replace(nameOrUid, scopedVars, variableInterpolation);
    if (interpolated !== nameOrUid) {
      const item = interpolated === 'default' ? getDefaultListItem() : lookupKey(interpolated);
      return item ? { item, templated: nameOrUid } : undefined;
    }
  }

  const item = lookupKey(nameOrUid);
  return item ? { item } : undefined;
}

function lookupKey(key: string): DataSourceInstanceListItem | undefined {
  const item = getListItemByUid(key) ?? getListItemByName(key);
  if (item) {
    return item;
  }
  const byId = getListItemById(key);
  if (byId) {
    warnNumericIdRef(key);
  }
  return byId;
}

// Numeric ids are going away: the MT APIs do not carry them. Log every distinct call path once
// per page load so the callers can be found and moved to uids. The stack names the public API the
// caller used, async callers included.
const loggedNumericIdRefs = new Set<string>();

function warnNumericIdRef(id: string): void {
  const stack = new Error().stack ?? '';
  const key = `${id}|${stack}`;
  if (loggedNumericIdRefs.has(key)) {
    return;
  }
  loggedNumericIdRefs.add(key);
  logDataSourceWarning(NUMERIC_ID_REF_WARNING, {
    id,
    path: getDataSourceCacheSource()?.kind ?? 'none',
    stack,
  });
}

function getNameOrUid(ref: DataSourceRef | string | null | undefined): string | undefined {
  if (ref == null) {
    return undefined;
  }
  return typeof ref === 'string' ? ref : ref.uid;
}

function isDataSourceRef(ref: DataSourceRef | string | null | undefined): ref is DataSourceRef {
  return ref != null && isObject(ref) && 'type' in ref;
}

function variableInterpolation<T>(value: T | T[]): T {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function _resetForTests(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('_resetForTests must only be called from tests');
  }
  loggedNumericIdRefs.clear();
}
