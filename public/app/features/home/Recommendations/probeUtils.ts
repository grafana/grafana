import { type DataSourceInstanceListItem } from '@grafana/data';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

/** Cap the probe fan-out: only the first N candidates (in priority order) are probed per page load. */
export const MAX_PROBED_DATASOURCES = 10;

// Probes gate homepage cards: 3 attempts x 30s meant a fallback could wait 92s+. 10s per attempt
// bounds the leader to ~32s worst case while still outlasting a slow-but-alive datasource.
export const PROBE_TIMEOUT_MS = 10_000;

/** One shared probe resolution per TTL window; a later home visit re-resolves after datasource changes. */
export const PROBE_TTL_MS = 60_000;

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
 * Candidate datasources of `type` for a data-existence probe: cloud utility datasources are
 * skipped (unless they are all there is), the default datasource leads, capped for fan-out.
 * Pass an Infinity `cap` when the caller reorders before capping itself.
 */
export async function listProbeCandidates(
  type: string,
  cap = MAX_PROBED_DATASOURCES
): Promise<DataSourceInstanceListItem[]> {
  const list = await withRetry(() =>
    getDataSourceInstanceList({
      type,
      // Reject the -- Grafana -- builtin by meta.id; a ds.type check would drop alias datasources.
      filter: (ds) => ds.meta.id !== 'grafana',
    })
  );
  const preferred = list.filter((ds) => !CLOUD_UTILITY_DATASOURCE_NAMES[ds.name]);
  const pool = preferred.length > 0 ? preferred : list;
  const def = pool.find((ds) => ds.isDefault);
  const ordered = def ? [def, ...pool.filter((ds) => ds !== def)] : [...pool];
  return ordered.slice(0, cap);
}

/**
 * Probe the top-priority candidate alone first: in the common case (the default datasource has
 * the data) this issues 1 query instead of N, and a transient sibling race can never outrank it.
 * Only when the leader has no data (or errors) fan out to the rest in parallel. `hasData` must
 * not throw — an unusable datasource counts as no data.
 */
export async function findDatasourceWithData(
  candidates: DataSourceInstanceListItem[],
  hasData: (ds: DataSourceInstanceListItem) => Promise<boolean>
): Promise<DataSourceInstanceListItem | null> {
  if (candidates.length === 0) {
    return null;
  }
  if (await hasData(candidates[0])) {
    return candidates[0];
  }
  const rest = candidates.slice(1);
  const probes = rest.map((ds) => hasData(ds));
  for (let i = 0; i < rest.length; i++) {
    // Await in priority order: a slow probe delays — never changes — the outcome.
    if (await probes[i]) {
      return rest[i];
    }
  }
  return null;
}
