import type { DataSourceApi, DataSourceRef, TimeRange } from '@grafana/data';
import type { PrometheusLanguageProviderInterface } from '@grafana/prometheus';
import { getDataSourceInstance } from '@grafana/runtime/unstable';

import type { MetricInfo } from '../types';

import { baseMetricName, deriveMetricType } from './metricType';

/**
 * Derive this with `Pick`, never restate it by hand: the tests mock this shape, so a hand-written copy
 * would keep agreeing with the mocks after an upstream rename or re-signing and break only
 * production. `Pick` fails to compile instead.
 */
type PromLanguageProvider = Pick<
  PrometheusLanguageProviderInterface,
  'datasource' | 'start' | 'retrieveMetrics' | 'retrieveMetricsMetadata' | 'queryLabelKeys' | 'queryLabelValues'
>;

type PromMetricsMetadata = ReturnType<PromLanguageProvider['retrieveMetricsMetadata']>;

/** A datasource's metric names, and whether the datasource's series limit cut the list short. */
export interface Catalog {
  metrics: MetricInfo[];
  truncated: boolean;
}

/**
 * How long a resolved entry is served from cache. This is a bound on staleness, not a refresh: nothing
 * re-runs on its own, so an expired entry is only re-fetched the next time something asks for it. It
 * also does not guarantee a network call — the Prometheus language provider holds its own cache
 * underneath, keyed on a range snapped to the datasource's cache level.
 */
export const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  value: Promise<T>;
  expiresAt: number;
}

const catalogCache = new Map<string, CacheEntry<Catalog>>();
const searchCache = new Map<string, CacheEntry<MetricInfo[]>>();
const labelKeysCache = new Map<string, CacheEntry<string[]>>();
const labelValuesCache = new Map<string, CacheEntry<string[]>>();

const allCaches = [catalogCache, searchCache, labelKeysCache, labelValuesCache];

function once<T>(cache: Map<string, CacheEntry<T>>, key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value;
  }
  const value = fn().catch((e) => {
    // Never cache a rejection: a transient failure shouldn't permanently poison a retry.
    cache.delete(key);
    throw e;
  });
  // Stamped when the request starts rather than when it resolves, so a slow fetch expires early
  // rather than extending its own lifetime by however long it took.
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/** Test helper — resets the module-level caches. Should only be called from tests. */
export function __clearCacheForTests() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('__clearCacheForTests must only be called from tests');
  }
  for (const cache of allCaches) {
    cache.clear();
  }
}

// Dropping cache entries is not on its own enough to refresh anything: the hooks only refetch when
// the request they are keyed on changes, and a relative range keeps the same key forever. So an
// invalidation also bumps a generation the hooks include in that key, and tells them it moved.
let globalGeneration = 0;
const generationByDsKey = new Map<string, number>();
const listeners = new Set<() => void>();

/**
 * The current cache generation for one `dsKey`. Changes whenever entries for that datasource are
 * invalidated, which is what makes the hooks treat the same datasource and range as a new request.
 */
export function getMetricCacheGeneration(key: string): number {
  return globalGeneration + (generationByDsKey.get(key) ?? 0);
}

/** Subscribe to invalidations. Returns the unsubscribe function, for `useSyncExternalStore`. */
export function subscribeToMetricCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Forget what is cached, so the next fetch goes back to the datasource — the refresh action a host
 * needs, because expiry alone never fires while a card sits open on a relative range.
 *
 * With a `dsRef`, only that datasource's entries go and only hooks pointed at it refetch. With no
 * argument, everything goes: every mounted hook re-requests, and any datasource that is genuinely
 * unchanged just pays for one round trip.
 */
export function invalidateMetricCache(dsRef?: DataSourceRef): void {
  if (dsRef) {
    const key = dsKey(dsRef);
    for (const cache of allCaches) {
      for (const cacheKey of cache.keys()) {
        // Keys are `${tag}:${dsKey}:${rest}` — see the `fetch*` functions below.
        if (cacheKey.slice(cacheKey.indexOf(':') + 1).startsWith(`${key}:`)) {
          cache.delete(cacheKey);
        }
      }
    }
    generationByDsKey.set(key, (generationByDsKey.get(key) ?? 0) + 1);
  } else {
    for (const cache of allCaches) {
      cache.clear();
    }
    globalGeneration++;
  }

  for (const listener of listeners) {
    listener();
  }
}

/**
 * The cache identity of a time range, on the same terms as `dsKey`. A refresh that keeps the same
 * relative range string (`now-1h`/`now`) is deliberately the same key: it is served from cache, so
 * anything keying off it should treat it as the same request rather than start over.
 */
export function rangeKey(tr: TimeRange): string {
  return `${tr.raw?.from ?? ''}:${tr.raw?.to ?? ''}`;
}

/**
 * The cache identity of a datasource ref. Exported so the hooks key their refetches on exactly what
 * the cache keys its entries on — two refs this considers equal are served the same data, so a hook
 * that told them apart would fetch nothing new.
 *
 * `DataSourceRef.uid` is optional. A ref with no `uid` (e.g. `{ type: 'prometheus' }`, meaning "the
 * default datasource of this type") always resolves to the same concrete instance within a session,
 * so keying on `type` in that case is safe. The `u:`/`t:` prefixes keep a `uid` value from ever
 * colliding with a `type` value that happens to be the same string.
 */
export function dsKey(dsRef: DataSourceRef): string {
  if (dsRef.uid) {
    return `u:${dsRef.uid}`;
  }
  if (dsRef.type) {
    return `t:${dsRef.type}`;
  }
  return 'unknown';
}

async function getLP(dsRef: DataSourceRef): Promise<PromLanguageProvider> {
  const ds: DataSourceApi & { languageProvider?: PromLanguageProvider } = await getDataSourceInstance(dsRef);
  if (!ds.languageProvider) {
    throw new Error('Datasource has no Prometheus language provider');
  }
  return ds.languageProvider;
}

// A Prometheus 3.x UTF-8 metric name can contain a quote or a backslash; unescaped, either one ends
// the string literal early and the datasource rejects the selector as malformed.
const selector = (metric: string) => `{__name__="${metric.replace(/[\\"]/g, '\\$&')}"}`;

// Regex metacharacters are escaped so the term matches literally, then the result is escaped again
// for the PromQL string literal it sits in. `(?i)` keeps the search case-insensitive.
const searchSelector = (term: string) => {
  const literal = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `{__name__=~"(?i).*${literal.replace(/[\\"]/g, '\\$&')}.*"}`;
};

function toMetricInfos(names: string[], meta: PromMetricsMetadata, catalog: ReadonlySet<string>): MetricInfo[] {
  return names.map<MetricInfo>((name) => {
    // Metadata is keyed by the metric family, so a classic histogram or summary series has none of
    // its own; fall back to its family's. Own entry first, in case a metric really is named with
    // one of those suffixes.
    const entry = meta[name] ?? meta[baseMetricName(name)];
    return {
      name,
      type: deriveMetricType(name, entry, catalog),
      help: entry?.help,
      unit: entry?.unit,
    };
  });
}

export function fetchCatalog(dsRef: DataSourceRef, timeRange: TimeRange): Promise<Catalog> {
  return once(catalogCache, `cat:${dsKey(dsRef)}:${rangeKey(timeRange)}`, async () => {
    const lp = await getLP(dsRef);
    await lp.start(timeRange);
    const names = lp.retrieveMetrics() ?? [];
    const { datasource } = lp;
    const limit = datasource.seriesLimit;
    // Only the labels endpoint caps names at `seriesLimit`: the series endpoint caps series, which
    // yield far fewer names, and the search API applies its own lower cap. Neither can be told apart
    // from a complete list, so both are treated as truncated.
    const capsNames = datasource.hasLabelsMatchAPISupport() && !datasource.hasSearchApiSupport();
    return {
      metrics: toMetricInfos(names, lp.retrieveMetricsMetadata() ?? {}, new Set(names)),
      // A capped request is answered with exactly `limit` names; zero means uncapped. With lookups
      // disabled nothing was fetched, and searching would send the requests the setting forbids.
      truncated: !datasource.lookupsDisabled && (!capsNames || (limit > 0 && names.length >= limit)),
    };
  });
}

// Keyed by free text, so unlike the other caches it would otherwise grow with every term typed.
const SEARCH_CACHE_MAX_ENTRIES = 20;

/**
 * Metric names containing `term`, matched by the datasource rather than against the catalog, which
 * may be missing names the series limit cut off.
 */
export function searchCatalog(dsRef: DataSourceRef, timeRange: TimeRange, term: string): Promise<MetricInfo[]> {
  // Lower-cased because the match is case-insensitive: `Quick` and `quick` are the same search.
  const key = `search:${dsKey(dsRef)}:${rangeKey(timeRange)}:${term.toLowerCase()}`;
  // Re-inserted on a hit so eviction drops the least recently used term, not the oldest one typed.
  const hit = searchCache.get(key);
  if (hit) {
    searchCache.delete(key);
    searchCache.set(key, hit);
  }
  const result = once(searchCache, key, async () => {
    const lp = await getLP(dsRef);
    const [names, catalog] = await Promise.all([
      lp.queryLabelValues(timeRange, '__name__', searchSelector(term)),
      // Loads the metadata the rows are typed from; already cached whenever the catalog is open.
      fetchCatalog(dsRef, timeRange),
    ]);
    // A term like `sum` matches `foo_sum` but not the `foo_bucket` that types it, so the loaded
    // catalog supplies the rest of the family.
    const known = new Set([...names, ...catalog.metrics.map((metric) => metric.name)]);
    return toMetricInfos(names, lp.retrieveMetricsMetadata() ?? {}, known);
  });
  // A `Map` iterates in insertion order, so the first key is the least recently used search.
  if (searchCache.size > SEARCH_CACHE_MAX_ENTRIES) {
    const oldest = searchCache.keys().next().value;
    if (oldest !== undefined) {
      searchCache.delete(oldest);
    }
  }
  return result;
}

export function fetchLabelKeys(dsRef: DataSourceRef, timeRange: TimeRange, metric: string): Promise<string[]> {
  return once(labelKeysCache, `lk:${dsKey(dsRef)}:${rangeKey(timeRange)}:${metric}`, async () => {
    const lp = await getLP(dsRef);
    const keys = await lp.queryLabelKeys(timeRange, selector(metric));
    // `__name__` comes back because the selector matches on it, and the language provider returns the
    // endpoint's answer verbatim. It is an artifact of how we asked, not a label of the metric: its
    // only value is the metric name we already have.
    return keys.filter((key) => key !== '__name__');
  });
}

export function fetchLabelValues(
  dsRef: DataSourceRef,
  timeRange: TimeRange,
  metric: string,
  labelKey: string
): Promise<string[]> {
  return once(labelValuesCache, `lv:${dsKey(dsRef)}:${rangeKey(timeRange)}:${metric}:${labelKey}`, async () => {
    const lp = await getLP(dsRef);
    return lp.queryLabelValues(timeRange, labelKey, selector(metric));
  });
}
