import memoize from 'micro-memoize';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { DataSourceWithBackend, getBackendSrv } from '@grafana/runtime';
import { getDataSourceInstance, getDataSourceInstanceList } from '@grafana/runtime/unstable';

/**
 * A lazily-started, shared solution fact derived from the solution's datasource: the first read
 * resolves the datasource and starts `fetch`; every reader shares that one run. No datasource
 * (solution not live) reads as null without starting the query.
 */
export function datasourceFact<T>(
  datasource: () => Promise<DataSourceInstanceListItem | null>,
  fetch: (ds: DataSourceInstanceListItem) => Promise<T | null>,
  {
    retryOnError = false,
  }: {
    /** Evict rejections so a later reader retries instead of sharing the cached failure. */
    retryOnError?: boolean;
  } = {}
): () => Promise<T | null> {
  return memoize(
    async () => {
      const ds = await datasource();
      return ds ? fetch(ds) : null;
    },
    { isPromise: retryOnError }
  );
}

/** Cap the probe fan-out: only the first N candidates (in priority order) are probed per page load. */
export const MAX_PROBED_DATASOURCES = 10;

// Probes gate homepage cards: 10s outlasts a slow-but-alive datasource without stalling the region.
export const PROBE_TIMEOUT_MS = 10_000;

/** One shared probe resolution per TTL window; a later home visit re-resolves after datasource changes. */
export const PROBE_TTL_MS = 60_000;

// ponytail: 3s /health cutoff (drilldown's) — suspected too tight for OPS-scale instances; revisit as follow-up.
export const HEALTH_CHECK_TIMEOUT_MS = 3000;

/** Hard ceiling per signal; detectSignal reads it. */
export const SIGNAL_BUDGET_MS = 30_000;

// Batching bounds the fan-out. The solution scans run together and share the browser's per-host
// connection pool, where a queued probe burns its timeout unsent; and the default datasource
// (candidate 0) usually hits, so a first-batch hit leaves the second five unissued. Five is the
// smallest batch that covers the cap in two rounds, and two rounds of (health + probe timeout)
// fit SIGNAL_BUDGET_MS. A literal, not derived arithmetic: the fake-timer budget test fails if a
// timeout change breaks the fit.
const PROBE_BATCH_SIZE = 5;

// Grafana Cloud's utility datasources — never where product data lives. Prometheus utilities
// (billing/ML) carry exact unprefixed names; Loki utilities (query logs, alert history) are
// provisioned with stack-prefixed names (grafanacloud-<slug>-usage-insights) over stable
// unprefixed uids, so the name check matches both forms.
const CLOUD_UTILITY_DATASOURCE_NAMES: ReadonlySet<string> = new Set(['grafanacloud-usage', 'grafanacloud-ml-metrics']);
const CLOUD_UTILITY_LOKI_NAME_PATTERN = /^grafanacloud-(.+-)?(usage-insights|alert-state-history)$/;
function isCloudUtilityDatasourceName(name: string): boolean {
  return CLOUD_UTILITY_DATASOURCE_NAMES.has(name) || CLOUD_UTILITY_LOKI_NAME_PATTERN.test(name);
}

/** Backend-capable datasource instance for `uid`, or null when it cannot serve resource calls. */
export async function resolveBackendInstance(uid: string): Promise<DataSourceWithBackend | null> {
  const instance = await getDataSourceInstance({ uid });
  return instance instanceof DataSourceWithBackend ? instance : null;
}

/**
 * GET through the classic datasource proxy, timeout-bounded, never toasts. Some datasource
 * backends (e.g. Tempo) serve their HTTP API only here, not on the resource router.
 */
export async function probeProxyGet<T>(
  uid: string,
  path: string,
  params: Record<string, unknown>,
  timeoutMs = PROBE_TIMEOUT_MS
): Promise<T> {
  const url = `/api/datasources/proxy/uid/${encodeURIComponent(uid)}/${path}`;
  return withTimeout(getBackendSrv().get<T>(url, params, undefined, { showErrorAlert: false }), timeoutMs);
}

/** Rejects when `promise` outlasts `ms`; the underlying request keeps running but stops gating the caller. */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Probe timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export interface TtlCachedPromise<T> {
  get(): Promise<T>;
  reset(): void;
}

/** Owns the cached promise + timestamp in a closure so no module-level binding is mutated. */
export function createTtlCachedPromise<T>(fn: () => Promise<T>, ttlMs: number): TtlCachedPromise<T> {
  let cached: Promise<T> | undefined;
  let cachedAt = 0;
  return {
    get() {
      if (!cached || Date.now() - cachedAt > ttlMs) {
        cachedAt = Date.now();
        const next: Promise<T> = fn().catch((err) => {
          // A transient rejection must not poison the cache for a whole TTL window.
          if (cached === next) {
            cached = undefined;
          }
          throw err;
        });
        cached = next;
      }
      return cached;
    },
    reset() {
      cached = undefined;
      cachedAt = 0;
    },
  };
}

/** Probe candidates of `type`, default first. Cloud utilities and `excludeUids` never qualify: platform telemetry must not settle a product-data probe. */
export async function listProbeCandidates(
  type: string,
  excludeUids?: ReadonlySet<string>
): Promise<DataSourceInstanceListItem[]> {
  const list = await getDataSourceInstanceList({
    type,
    // Reject the -- Grafana -- builtin by meta.id; a ds.type check would drop alias datasources.
    filter: (ds) => ds.meta.id !== 'grafana',
  });
  const pool = list.filter((ds) => !excludeUids?.has(ds.uid) && !isCloudUtilityDatasourceName(ds.name));
  const def = pool.find((ds) => ds.isDefault);
  return def ? [def, ...pool.filter((ds) => ds !== def)] : pool;
}

const healthCache = new Map<string, TtlCachedPromise<boolean>>();

/**
 * Whether /health reports OK for `uid`, shared by every scan that meets the datasource within the
 * TTL window. Rejections and the 3s cutoff read as unhealthy and are cached like any answer.
 */
export function isDatasourceHealthy(uid: string): Promise<boolean> {
  let cache = healthCache.get(uid);
  if (!cache) {
    cache = createTtlCachedPromise(
      () =>
        withTimeout(
          getBackendSrv().get<{ status?: string }>(
            `/api/datasources/uid/${encodeURIComponent(uid)}/health`,
            undefined,
            undefined,
            { showErrorAlert: false }
          ),
          HEALTH_CHECK_TIMEOUT_MS
        )
          .then((res) => res?.status === 'OK')
          .catch(() => false),
      PROBE_TTL_MS
    );
    healthCache.set(uid, cache);
  }
  return cache.get();
}

export function resetProbeHealth(): void {
  healthCache.clear();
}

/**
 * First candidate (priority order) whose probe confirms data, or null. Scans at most
 * MAX_PROBED_DATASOURCES candidates in batches of PROBE_BATCH_SIZE; each is probed once its own
 * /health is OK, and a hit returns as soon as every higher-priority candidate in its batch has
 * settled without one. Unhealthy candidates and probe errors read as no data.
 */
export async function findDatasourceWithData(
  candidates: DataSourceInstanceListItem[],
  hasData: (ds: DataSourceInstanceListItem) => Promise<boolean>
): Promise<DataSourceInstanceListItem | null> {
  const capped = candidates.slice(0, MAX_PROBED_DATASOURCES);
  for (let i = 0; i < capped.length; i += PROBE_BATCH_SIZE) {
    const batch = capped.slice(i, i + PROBE_BATCH_SIZE);
    const probes = batch.map((ds) =>
      isDatasourceHealthy(ds.uid)
        .then((ok) => ok && hasData(ds))
        .catch(() => false)
    );
    // Awaited in priority order: a hit returns without waiting for lower-priority siblings.
    for (let j = 0; j < probes.length; j++) {
      if (await probes[j]) {
        return batch[j];
      }
    }
  }
  return null;
}
