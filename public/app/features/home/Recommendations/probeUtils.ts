import { type DataSourceInstanceListItem } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

/** Cap the probe fan-out: only the first N candidates (in priority order) are probed per page load. */
export const MAX_PROBED_DATASOURCES = 10;

// Probes gate homepage cards: 10s outlasts a slow-but-alive datasource without stalling the region.
export const PROBE_TIMEOUT_MS = 10_000;

/** One shared probe resolution per TTL window; a later home visit re-resolves after datasource changes. */
export const PROBE_TTL_MS = 60_000;

// ponytail: 3s /health cutoff (drilldown's) — suspected too tight for OPS-scale instances; revisit as follow-up.
const HEALTH_CHECK_TIMEOUT_MS = 3000;

// Spacing between retry attempts: the transient browser-side failures observed on the homepage
// (connection queuing, gateway blips) can outlast an immediate retry; a short backoff covers
// them while the region shows its skeleton. 3 attempts total.
const RETRY_DELAYS_MS = [500, 1500];

// Exact names of Grafana Cloud's utility Prometheus datasources (billing/ML) — never where product data lives.
const CLOUD_UTILITY_DATASOURCE_NAMES: Record<string, true> = {
  'grafanacloud-usage': true,
  'grafanacloud-ml-metrics': true,
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length) {
        throw err;
      }
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

/**
 * GET through the classic datasource proxy, timeout-bounded, never toasts. Some datasource
 * backends (e.g. Tempo) serve their HTTP API only here, not on the resource router.
 */
export async function probeProxyGet<T>(uid: string, path: string, params: Record<string, unknown>): Promise<T> {
  const url = `/api/datasources/proxy/uid/${encodeURIComponent(uid)}/${path}`;
  return withTimeout(getBackendSrv().get<T>(url, params, undefined, { showErrorAlert: false }), PROBE_TIMEOUT_MS);
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

/** Owns the cached promise + timestamp in a closure so no module-level binding is mutated. */
export function createTtlCachedPromise<T>(fn: () => Promise<T>, ttlMs: number): { get(): Promise<T>; reset(): void } {
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

/**
 * Candidate datasources of `type` for a data-existence probe: `excludeUids` are dropped
 * unconditionally (never re-admitted by any fallback), cloud utility datasources are
 * skipped (unless they are all there is), the default datasource leads, capped for fan-out.
 * Pass an Infinity `cap` when the caller reorders before capping itself.
 */
export async function listProbeCandidates(
  type: string,
  cap = MAX_PROBED_DATASOURCES,
  excludeUids?: ReadonlySet<string>
): Promise<DataSourceInstanceListItem[]> {
  const list = await getDataSourceInstanceList({
    type,
    // Reject the -- Grafana -- builtin by meta.id; a ds.type check would drop alias datasources.
    filter: (ds) => ds.meta.id !== 'grafana',
  });
  const eligible = excludeUids ? list.filter((ds) => !excludeUids.has(ds.uid)) : list;
  const preferred = eligible.filter((ds) => !CLOUD_UTILITY_DATASOURCE_NAMES[ds.name]);
  const pool = preferred.length > 0 ? preferred : eligible;
  const def = pool.find((ds) => ds.isDefault);
  const ordered = def ? [def, ...pool.filter((ds) => ds !== def)] : [...pool];
  return ordered.slice(0, cap);
}

/** Candidates whose /health reports OK; broken or slow datasources drop out of detection. */
export async function filterHealthyDatasources(
  candidates: DataSourceInstanceListItem[]
): Promise<DataSourceInstanceListItem[]> {
  const results = await Promise.allSettled(
    candidates.map((ds) =>
      withTimeout(
        getBackendSrv().get<{ status?: string }>(
          `/api/datasources/uid/${encodeURIComponent(ds.uid)}/health`,
          undefined,
          undefined,
          { showErrorAlert: false }
        ),
        HEALTH_CHECK_TIMEOUT_MS
      )
    )
  );
  return candidates.filter((_, i) => {
    const result = results[i];
    return result.status === 'fulfilled' && result.value?.status === 'OK';
  });
}

/** First candidate (in priority order) whose probe confirms data; probe errors read as no data. */
export async function findDatasourceWithData(
  candidates: DataSourceInstanceListItem[],
  hasData: (ds: DataSourceInstanceListItem) => Promise<boolean>
): Promise<DataSourceInstanceListItem | null> {
  const results = await Promise.allSettled(candidates.map((ds) => hasData(ds)));
  const winner = results.findIndex((result) => result.status === 'fulfilled' && result.value === true);
  return winner === -1 ? null : candidates[winner];
}
