import type { DataSourceApi, DataSourceRef, TimeRange } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime/unstable';

import type { MetricRow } from '../types';

import { deriveMetricType } from './metricType';

// Minimal shape we rely on from the Prometheus language provider (see @grafana/prometheus dist types).
interface PromLanguageProvider {
  start(timeRange?: TimeRange): Promise<unknown[]>;
  retrieveMetrics(): string[];
  retrieveMetricsMetadata(): Record<string, { type?: string; help?: string; unit?: string }>;
  queryLabelKeys(timeRange: TimeRange, match?: string, limit?: number): Promise<string[]>;
  queryLabelValues(timeRange: TimeRange, labelKey: string, match?: string, limit?: number): Promise<string[]>;
}

const catalogCache = new Map<string, Promise<MetricRow[]>>();
const labelKeysCache = new Map<string, Promise<string[]>>();
const labelValuesCache = new Map<string, Promise<string[]>>();

function once<T>(cache: Map<string, Promise<T>>, key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit) {
    return hit;
  }
  const p = fn().catch((e) => {
    // Never cache a rejection: a transient failure shouldn't permanently poison a retry.
    cache.delete(key);
    throw e;
  });
  cache.set(key, p);
  return p;
}

/** Test-only: reset the module-level caches between test cases. Not part of the public API. */
export function __clearCache() {
  catalogCache.clear();
  labelKeysCache.clear();
  labelValuesCache.clear();
}

function rangeKey(tr: TimeRange): string {
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
    return names.map<MetricRow>((name) => ({
      name,
      type: deriveMetricType(name, meta[name]),
      help: meta[name]?.help,
      unit: meta[name]?.unit,
    }));
  });
}

export function fetchLabelKeys(dsRef: DataSourceRef, timeRange: TimeRange, metric: string): Promise<string[]> {
  return once(labelKeysCache, `lk:${dsKey(dsRef)}:${rangeKey(timeRange)}:${metric}`, async () => {
    const lp = await getLP(dsRef);
    return lp.queryLabelKeys(timeRange, selector(metric));
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
