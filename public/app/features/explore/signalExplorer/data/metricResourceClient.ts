import type { DataSourceApi, DataSourceRef, TimeRange } from '@grafana/data';
import type { PrometheusLanguageProviderInterface } from '@grafana/prometheus';
import { getDataSourceInstance } from '@grafana/runtime/unstable';

import type { MetricRow } from '../types';

import { baseMetricName, deriveMetricType } from './metricType';

/**
 * The part of the Prometheus language provider this module calls — derived from the real interface
 * with `Pick`, not restated here.
 *
 * A hand-written copy of this shape is what every test in this module mocks, so if upstream renamed
 * `retrieveMetrics` or re-signed `queryLabelValues`, the copy and the mocks would agree with each
 * other, the suite would stay green, and only production would break. `Pick` fails to compile
 * instead: an absent key is an error, and a changed signature propagates straight into the call
 * sites below.
 *
 * `import type` is erased at build time, so this costs nothing at runtime even though the Prometheus
 * datasource is no longer a core plugin.
 */
type PromLanguageProvider = Pick<
  PrometheusLanguageProviderInterface,
  'start' | 'retrieveMetrics' | 'retrieveMetricsMetadata' | 'queryLabelKeys' | 'queryLabelValues'
>;

/**
 * How long a resolved entry is served from cache. A relative range (`now-1h`/`now`) is one cache key
 * for the whole life of the page, so without expiry a catalog fetched on first open would still be
 * the answer hours later and a metric scraped since would never appear.
 *
 * Five minutes is the safety net, not the refresh mechanism: nothing re-runs on its own, so an entry
 * is only re-fetched the next time something asks for it after expiry (a card reopening, a range
 * change, or `invalidateMetricCache`). Actual freshness is also bounded below by the Prometheus
 * language provider's own cache, which snaps a range to an interval derived from the datasource's
 * cache level — expiring here lets a request through, it does not guarantee a network call.
 */
export const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  value: Promise<T>;
  expiresAt: number;
}

const catalogCache = new Map<string, CacheEntry<MetricRow[]>>();
const labelKeysCache = new Map<string, CacheEntry<string[]>>();
const labelValuesCache = new Map<string, CacheEntry<string[]>>();

const allCaches = [catalogCache, labelKeysCache, labelValuesCache];

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

/** Test-only: reset the module-level caches between test cases. Not part of the public API. */
export function __clearCache() {
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

export function fetchCatalog(dsRef: DataSourceRef, timeRange: TimeRange): Promise<MetricRow[]> {
  return once(catalogCache, `cat:${dsKey(dsRef)}:${rangeKey(timeRange)}`, async () => {
    const lp = await getLP(dsRef);
    await lp.start(timeRange);
    const names = lp.retrieveMetrics() ?? [];
    const meta = lp.retrieveMetricsMetadata() ?? {};
    return names.map<MetricRow>((name) => {
      // Metadata is keyed by the metric family, so a classic histogram or summary series has none of
      // its own; fall back to its family's. Own entry first, in case a metric really is named with
      // one of those suffixes.
      const entry = meta[name] ?? meta[baseMetricName(name)];
      return {
        name,
        type: deriveMetricType(name, entry),
        help: entry?.help,
        unit: entry?.unit,
      };
    });
  });
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
