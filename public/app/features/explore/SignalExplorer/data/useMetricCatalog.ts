import { useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'react-use';

import type { DataSourceRef, TimeRange } from '@grafana/data';

import type { MetricInfo, MetricType } from '../types';

import { type Catalog, dsKey, fetchCatalog, rangeKey, searchCatalog } from './metricResourceClient';
import { useAsyncResource } from './useAsyncResource';
import { useMetricCacheGeneration } from './useMetricCacheGeneration';

const NO_METRICS: MetricInfo[] = [];
const NO_CATALOG: Catalog = { metrics: NO_METRICS, truncated: false, searchable: false };

export const SEARCH_DEBOUNCE_MS = 300;

/** What a catalog reader gets. */
export interface MetricCatalog {
  metrics: MetricInfo[];
  /** Whether `metrics` comes from a catalog the series limit cut short, so its length is no total. */
  truncated: boolean;
  loading: boolean;
  error?: Error;
}

/**
 * A datasource's metrics, narrowed by `searchText`. A term is matched by the datasource, as the query
 * editor's metric search is, since the catalog may be missing exactly the names a user is looking for.
 */
export function useMetricCatalog(
  dsRef: DataSourceRef,
  timeRange: TimeRange,
  opts?: { typeFilter?: MetricType | null; searchText?: string }
): MetricCatalog {
  const generation = useMetricCacheGeneration(dsRef);
  const requestKey = `${dsKey(dsRef)}|${rangeKey(timeRange)}|${generation}`;

  const catalog = useAsyncResource(requestKey, () => fetchCatalog(dsRef, timeRange), NO_CATALOG);

  const term = (opts?.searchText ?? '').trim();
  const [debouncedTerm, setDebouncedTerm] = useState(term);
  // Clearing skips the debounce: the catalog is already the answer to an empty search, and a term
  // typed straight afterwards must not inherit the previous one.
  if (term === '' && debouncedTerm !== '') {
    setDebouncedTerm('');
  }
  useDebounce(() => setDebouncedTerm(term), SEARCH_DEBOUNCE_MS, [term]);

  // Every term goes to the datasource, however complete the catalog looks: a server can answer with
  // fewer names than the series limit and still hold more, as Mimir does under its
  // `max_label_values_limit`.
  const serverSearch = catalog.data.searchable && debouncedTerm !== '';
  const search = useAsyncResource(
    serverSearch ? `${requestKey}|${debouncedTerm}` : null,
    () => searchCatalog(dsRef, timeRange, debouncedTerm),
    NO_METRICS
  );

  // A search in flight has no answer yet, and its data is reset to empty, so the list keeps what it
  // showed while the debounce was pending instead of going blank. Recorded in an effect, not during
  // render: `useAsyncResource` adjusts its state mid-render, so a render pass can briefly see the
  // previous request's data reported as settled.
  const searchInFlight = serverSearch && search.loading;
  const [lastSettled, setLastSettled] = useState<MetricInfo[]>(NO_METRICS);
  const settledSource = serverSearch ? search.data : catalog.data.metrics;
  useEffect(() => {
    if (!searchInFlight) {
      setLastSettled(settledSource);
    }
  }, [searchInFlight, settledSource]);

  // A term the debounce has not released yet is still waiting on the datasource.
  const pending = catalog.data.searchable && term !== '' && term !== debouncedTerm;

  // While waiting, the previous answer covers only terms that extend its own; the catalog's matches
  // cover a term edited any other way, such as backspaced or replaced.
  const interim = useMemo(() => mergeByName(lastSettled, catalog.data.metrics), [lastSettled, catalog.data.metrics]);
  const source = pending || searchInFlight ? interim : settledSource;

  // Filtered by the live term even when the datasource already did the matching, so results keep
  // narrowing as the user types rather than waiting out the debounce.
  const metrics = useMemo(() => {
    const q = term.toLowerCase();
    const type = opts?.typeFilter ?? null;
    return source.filter((m) => (!q || m.name.toLowerCase().includes(q)) && (!type || m.type === type));
  }, [source, term, opts?.typeFilter]);

  return {
    metrics,
    // A settled datasource search answers from the whole datasource, not the cut-short catalog.
    truncated: catalog.data.truncated && !serverSearch,
    loading: catalog.loading || search.loading || pending,
    // A failed search belongs to the term it was for, not to the one being typed now.
    error: catalog.error ?? (pending ? undefined : search.error),
  };
}

// Sorted like `searchCatalog`'s answer, so rows don't reorder when that answer lands.
function mergeByName(preferred: MetricInfo[], rest: MetricInfo[]): MetricInfo[] {
  if (preferred === rest || preferred.length === 0) {
    return rest;
  }
  const byName = new Map(rest.map((metric) => [metric.name, metric]));
  for (const metric of preferred) {
    byName.set(metric.name, metric);
  }
  return [...byName.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
