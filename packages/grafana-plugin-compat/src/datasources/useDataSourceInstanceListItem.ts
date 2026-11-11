/* eslint-disable @grafana/no-get-data-source-srv */
import { useMemo } from 'react';

import { type DataSourceInstanceListItem } from '@grafana/data';
import {
  getDataSourceSrv,
  useDataSourceInstanceListItem as stableUseDataSourceInstanceListItem,
} from '@grafana/runtime';

import { toDataSourceInstanceListItem } from './getDataSourceInstanceList';
import { type Ref } from './types';

/** Declared here because `@grafana/runtime` lacks it on older supported hosts. */
export interface UseDataSourceInstanceListItemResult {
  isLoading: boolean;
  error?: Error;
  item?: DataSourceInstanceListItem;
}

/**
 * Uses the host hook when available, which also re-resolves on data source cache changes; otherwise
 * resolves synchronously on every render. Picked once at load so the hook order stays stable.
 */
export const useDataSourceInstanceListItem: (ref?: Ref) => UseDataSourceInstanceListItemResult =
  typeof stableUseDataSourceInstanceListItem === 'function'
    ? stableUseDataSourceInstanceListItem
    : useBackwardsCompatibleDataSourceInstanceListItem;

function useBackwardsCompatibleDataSourceInstanceListItem(ref?: Ref): UseDataSourceInstanceListItemResult {
  const settings = getCachedInstanceSettings(ref);
  // The legacy service returns the same settings object until it reloads, so keying on it keeps `item` stable.
  const item = useMemo(() => (settings ? toDataSourceInstanceListItem(settings) : undefined), [settings]);

  return { isLoading: false, item };
}

// A template variable ref resolves to a fresh copy named after the variable; `rawRef` points at the
// cached settings, which carry the real uid and name like the host hook returns.
function getCachedInstanceSettings(ref?: Ref) {
  const settings = getDataSourceSrv().getInstanceSettings(ref);
  const resolvedUid = settings?.rawRef?.uid;

  return resolvedUid ? (getDataSourceSrv().getInstanceSettings(resolvedUid) ?? settings) : settings;
}
