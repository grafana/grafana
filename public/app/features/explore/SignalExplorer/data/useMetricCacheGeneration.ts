import { useCallback, useSyncExternalStore } from 'react';

import type { DataSourceRef } from '@grafana/data';

import { dsKey, getMetricCacheGeneration, subscribeToMetricCache } from './metricResourceClient';

/**
 * The cache generation of one datasource, re-read whenever `invalidateMetricCache` moves it.
 *
 * The three data hooks fold this into the key they refetch on, which is what turns invalidation into
 * a refresh: dropping cache entries on its own changes nothing a mounted hook can see, because a
 * relative range keeps the same datasource-and-range key for the life of the page.
 */
export function useMetricCacheGeneration(dsRef: DataSourceRef): number {
  const key = dsKey(dsRef);

  return useSyncExternalStore(
    subscribeToMetricCache,
    useCallback(() => getMetricCacheGeneration(key), [key])
  );
}
