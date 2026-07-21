// Shared plumbing for the homepage solution-card data modules (Kubernetes, Logs, Traces):
// retry/backoff, probe bounds, and TTL-cached resolution promises.

// Spacing between retry attempts: the transient browser-side failures observed on the homepage
// (connection queuing, gateway blips) can outlast an immediate retry; a short backoff covers
// them while the region shows its skeleton. 3 attempts total.
export const RETRY_DELAYS_MS = [500, 1500];

// Probes gate the whole card: 3 attempts × 30s meant fallback could wait 92s+. 10s per attempt
// bounds the leader to ~32s worst case while still outlasting a slow-but-alive datasource.
export const PROBE_TIMEOUT_MS = 10_000;

// Cap the probe fan-out: only the first 10 candidates (in priority order) are probed per page load.
export const MAX_PROBED_DATASOURCES = 10;

// One shared resolution per TTL window; the TTL lets a later home visit re-resolve after datasource changes.
export const RESOLUTION_TTL_MS = 60_000;

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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

// BackendSrvRequest has no per-request timeout option, so bounded probes race a rejecting timer.
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// Owns the cached promise + timestamp in a closure so no module-level binding is mutated.
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
