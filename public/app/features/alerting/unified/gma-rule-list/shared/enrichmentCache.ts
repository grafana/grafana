import { useEffect, useState } from 'react';

/**
 * Deduplicating, bounded-concurrency cache for per-row/per-folder enrichment lookups (full
 * rule GET, folder path, folder counts). The first iteration accepts a request per visible
 * row/folder, so this exists to keep that fan-out from opening unbounded parallel requests
 * and to make repeated lookups for the same key free.
 */
export class EnrichmentCache<K extends string, V> {
  private readonly cache = new Map<K, V>();
  private readonly pending = new Set<K>();
  private readonly errors = new Map<K, unknown>();
  private readonly queue: K[] = [];
  private readonly listeners = new Set<(key: K) => void>();
  private inFlight = 0;
  /** Fetches actually issued - never a queued-then-served-from-cache hit. For tests/measurement. */
  requestCount = 0;

  constructor(
    private readonly fetchFn: (key: K) => Promise<V>,
    private readonly maxConcurrency = 6
  ) {}

  get(key: K): V | undefined {
    return this.cache.get(key);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  isPending(key: K): boolean {
    return this.pending.has(key);
  }

  getError(key: K): unknown {
    return this.errors.get(key);
  }

  subscribe(listener: (key: K) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Idempotent: a key already cached, pending, or queued is left alone. */
  request(key: K): void {
    if (this.cache.has(key) || this.pending.has(key) || this.queue.includes(key)) {
      return;
    }
    this.errors.delete(key);
    if (this.inFlight >= this.maxConcurrency) {
      this.queue.push(key);
      return;
    }
    this.start(key);
  }

  /** Drops one entry so its next request re-fetches - for after a mutation that changed it. A
   * pending fetch for the same key is left to finish; its result is still cached afterward. */
  invalidate(key: K): void {
    this.cache.delete(key);
    this.errors.delete(key);
    this.notify(key);
  }

  /** Drops every cached/pending entry - tests only, so each test starts with a clean cache. */
  clear(): void {
    this.cache.clear();
    this.pending.clear();
    this.errors.clear();
    this.queue.length = 0;
    this.inFlight = 0;
    this.requestCount = 0;
  }

  private start(key: K): void {
    this.pending.add(key);
    this.inFlight++;
    this.requestCount++;

    this.fetchFn(key).then(
      (value) => {
        this.cache.set(key, value);
        this.pending.delete(key);
        this.inFlight--;
        this.notify(key);
        this.drainQueue();
      },
      (error: unknown) => {
        // A failed lookup only affects the cell(s) requesting this key - it must not poison
        // the cache (so a later request can retry) or crash the enclosing row/folder.
        this.pending.delete(key);
        this.errors.set(key, error);
        this.inFlight--;
        this.notify(key);
        this.drainQueue();
      }
    );
  }

  private drainQueue(): void {
    while (this.inFlight < this.maxConcurrency && this.queue.length > 0) {
      const key = this.queue.shift();
      if (key !== undefined && !this.cache.has(key) && !this.pending.has(key)) {
        this.start(key);
      }
    }
  }

  private notify(key: K): void {
    for (const listener of this.listeners) {
      listener(key);
    }
  }
}

/** Reads (and requests, if missing) a cache entry. Re-renders when that key's entry changes;
 * unaffected by other keys resolving. `key === undefined` skips the request entirely. */
export function useEnrichmentEntry<K extends string, V>(
  cache: EnrichmentCache<K, V>,
  key: K | undefined
): V | undefined {
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (key === undefined) {
      return;
    }
    const unsubscribe = cache.subscribe((changedKey) => {
      if (changedKey === key) {
        setVersion((v) => v + 1);
      }
    });
    cache.request(key);
    return unsubscribe;
  }, [cache, key]);

  return key !== undefined ? cache.get(key) : undefined;
}

export type EnrichmentState<V> = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; value: V };

/** Like useEnrichmentEntry, but distinguishes still-loading from failed - a missing value alone
 * can't tell those apart, and consumers gating actions on a full resource need to know which. */
export function useEnrichmentState<K extends string, V>(cache: EnrichmentCache<K, V>, key: K): EnrichmentState<V> {
  const [, setVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = cache.subscribe((changedKey) => {
      if (changedKey === key) {
        setVersion((v) => v + 1);
      }
    });
    cache.request(key);
    return unsubscribe;
  }, [cache, key]);

  const cached = cache.get(key);
  if (cached !== undefined) {
    return { status: 'loaded', value: cached };
  }
  if (cache.getError(key) !== undefined) {
    return { status: 'error' };
  }
  return { status: 'loading' };
}
