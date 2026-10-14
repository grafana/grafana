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

  // With nothing settled to keep, as on the first search after the catalog (re)loads, the catalog's
  // own matches are the best interim answer.
  const source = searchInFlight ? (lastSettled.length > 0 ? lastSettled : catalog.data.metrics) : settledSource;

  // Filtered by the live term even when the datasource already did the matching, so results keep
  // narrowing as the user types rather than waiting out the debounce.
  const metrics = useMemo(() => {
    const q = term.toLowerCase();
    const type = opts?.typeFilter ?? null;
    return source.filter((m) => (!q || m.name.toLowerCase().includes(q)) && (!type || m.type === type));
  }, [source, term, opts?.typeFilter]);

  // A term the debounce has not released yet is still waiting on the datasource.
  const pending = catalog.data.searchable && term !== '' && term !== debouncedTerm;

  return {
    metrics,
    // A settled datasource search answers from the whole datasource, not the cut-short catalog.
    truncated: catalog.data.truncated && !serverSearch,
    loading: catalog.loading || search.loading || pending,
    // A failed search belongs to the term it was for, not to the one being typed now.
    error: catalog.error ?? (pending ? undefined : search.error),
  };
}
