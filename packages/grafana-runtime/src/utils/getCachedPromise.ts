import { hash } from 'immutable';
import { LRUCache } from 'lru-cache';
import { v4 as uuidv4 } from 'uuid';

import { type LogContext } from '@grafana/faro-web-sdk';

import { getLogger } from '../services/logging/registry';

// 500 is our best guestimate right now. If a session
// goes past 500 entries, the LRU evicts the oldest one, at worst a refetch,
// never a full cache wipe.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new LRUCache<string, Promise<any>>({
  max: 500,
});

interface OnErrorArgs {
  error: unknown;
}

interface CacheKeyOptions {
  cacheKey?: string;
}

type PromiseFunction<T> = () => Promise<T>;

interface CachedPromiseOptions<T> extends CacheKeyOptions {
  defaultValue?: T;
  invalidate?: boolean;
  onError?: (args: OnErrorArgs) => Promise<T>;
}

interface CachePromiseThatPropagatesError<T> {
  key: string;
  promise: PromiseFunction<T>;
}

interface CachePromiseWithDefaultArgs<T> {
  key: string;
  promise: PromiseFunction<T>;
  defaultValue: T;
}

interface CachePromiseWithCallbackArgs<T> {
  key: string;
  promise: PromiseFunction<T>;
  onError: (args: OnErrorArgs) => Promise<T>;
}

interface LogErrorArgs {
  error: unknown;
  key: string;
}

interface GetCachedPromiseWithArgsOptions<T, TArgs extends unknown[]>
  extends Pick<CachedPromiseOptions<T>, 'defaultValue' | 'invalidate' | 'onError'> {
  cacheKeyFn?: (...args: TArgs) => string;
}

function invalidateCacheIfNotReplaced<T>(key: string, cached: Promise<T>): void {
  // Only delete this entry if our promise is still the cached value. Another
  // caller may have used replaceCachedPromise to store a new value here while
  // our promise was running, and we must not delete that new value.
  if (cache.peek(key) !== cached) {
    return;
  }

  cache.delete(key);
}

function logError({ error, key }: LogErrorArgs): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));

    const context: LogContext = { message: err.message, key };
    if (err.stack) {
      context.stack = err.stack;
    }

    getLogger('grafana/runtime.utils.getCachedPromise').logError(
      new Error(`getCachedPromise: Something failed while resolving a cached promise`, { cause: error }),
      context
    );
  } catch (error) {
    console.error(error);
  }
}

function cachePromiseThatPropagatesError<T>({ key, promise }: CachePromiseThatPropagatesError<T>): Promise<T> {
  const cached = promise().catch((error) => {
    logError({ error, key });
    invalidateCacheIfNotReplaced(key, cached);
    throw error;
  });
  cache.set(key, cached);

  return cached;
}

function cachePromiseWithDefaultValue<T>({ defaultValue, key, promise }: CachePromiseWithDefaultArgs<T>): Promise<T> {
  const cached = promise().catch((error) => {
    logError({ error, key });
    invalidateCacheIfNotReplaced(key, cached);
    return defaultValue;
  });
  cache.set(key, cached);

  return cached;
}

function cachePromiseWithCallback<T>({ key, promise, onError }: CachePromiseWithCallbackArgs<T>): Promise<T> {
  const cached = promise().catch((error) => {
    logError({ error, key });
    invalidateCacheIfNotReplaced(key, cached);
    return onError({ error });
  });
  cache.set(key, cached);

  return cached;
}

/**
 * Returns a deterministic cache key derived from a promise-returning function's name and source.
 *
 * The key has the format `${name}:${hash}` where `hash` is computed from `function.toString()`.
 * This means two functions sharing a name but with different bodies produce different keys, while
 * the same function always yields the same key.
 *
 * Returns `undefined` when no function is provided or when the function is anonymous —
 * most commonly an inline arrow function passed directly (e.g. `getCachedPromise(() => fetch(...))`).
 *
 * @template T - The type of the resolved promise value
 * @param promise - The promise-returning function to derive the cache key from
 * @returns A `${name}:${hash}` cache key or `undefined` if no function is provided or the function is anonymous
 */
export function getCacheKeyFromPromise<T>(promise?: PromiseFunction<T>): string | undefined {
  if (!promise?.name) {
    return undefined;
  }

  const name = promise.name;
  const hashValue = hash(promise.toString());
  const key = `${name}:${hashValue}`;
  return key;
}

/**
 * This utility function will safely handle concurrent requests for the same resource by caching the promise.
 * Caches the result of a promise based on a key derived from the promise function's name and body
 * (via {@link getCacheKeyFromPromise}) or on an explicit `cacheKey`. If a cached promise exists
 * for the given key, it returns the cached promise. Otherwise, it executes the promise function
 * and caches the result.
 *
 * On error, the cache entry is always invalidated and the error is always logged.
 * If a `defaultValue` is provided, it is returned instead of throwing.
 * If an `onError` callback is provided, its return value is used instead of throwing.
 * If neither is provided, the error propagates after logging and cache invalidation.
 *
 * @template T - The type of the resolved promise value
 * @param promise - Function that returns the promise to be cached. Inline arrow functions are
 *   anonymous and will be rejected unless an explicit `cacheKey` is provided — assign the arrow
 *   to a `const` first so name inference applies.
 * @param options - Options object for keying, invalidation, and error handling
 * @param options.cacheKey - Optional cache key to use instead of the one derived from the function's name and body
 * @param options.defaultValue - Optional default value to return if the promise rejects
 * @param options.invalidate - Optionally invalidates the cache for the derived key or `cacheKey`
 * @param options.onError - Optional error handler that receives the error and returns a fallback value
 * @returns A promise that resolves to the cached or newly computed value
 */
export function getCachedPromise<T>(promise: PromiseFunction<T>, options?: CachedPromiseOptions<T>): Promise<T> {
  const { cacheKey, defaultValue, onError, invalidate = false } = options ?? {};
  const key = cacheKey ?? getCacheKeyFromPromise(promise);

  if (!key) {
    return Promise.reject(new Error(`getCachedPromise function must be invoked with a named function or cacheKey`));
  }

  if (invalidate) {
    cache.delete(key);
  }

  const cached = cache.get(key);

  if (cached) {
    return cached;
  }

  if (onError) {
    return cachePromiseWithCallback({ key, onError, promise });
  }

  if (defaultValue !== undefined) {
    return cachePromiseWithDefaultValue({ defaultValue, key, promise });
  }

  return cachePromiseThatPropagatesError({ key, promise });
}

export function invalidateCachedPromisesCache() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('invalidateCachedPromisesCache function can only be called from tests.');
  }

  cache.clear();
}

/**
 * Serializes a value with a typeof prefix to avoid collisions
 * between different types (e.g. null vs undefined, 1 vs "1").
 *
 * Uses `JSON.stringify` internally, so only JSON-safe values (primitives, plain objects,
 * and arrays) produce stable cache keys. If serialization fails (e.g. circular references),
 * a unique uncacheable key is generated and the failure is logged as an error.
 *
 * For arguments that are not plain POJOs (e.g. `Map`, `Set`, `Date`, `RegExp`, class instances),
 * use the `cacheKeyFn` parameter on {@link getCachedPromiseWithArgs} instead.
 */
export function serializeArg(value: unknown, baseKey: string): string {
  const type = typeof value;

  try {
    return `${type}:${JSON.stringify(value)}`;
  } catch (error) {
    const key = `uncacheable:${uuidv4()}`;
    getLogger('grafana/runtime.utils.getCachedPromise').logError(
      new Error(`getCachedPromiseWithArgs: serializeArg failed`, { cause: error }),
      { baseKey, key }
    );
    return key;
  }
}

/**
 * Creates a cached version of a promise-returning function, keyed by its arguments.
 *
 * The base cache key is derived from the function's name and body via
 * {@link getCacheKeyFromPromise}, then combined with the per-call argument key.
 *
 * By default, cache keys are derived by serializing each argument with {@link serializeArg}
 * using `JSON.stringify`. This works reliably for:
 * - Primitives: `string`, `number`, `boolean`, `null`, `undefined`, `bigint`
 * - Plain objects (POJOs) and arrays
 *
 * **If your function accepts non-POJO arguments** (e.g. `Map`, `Set`, `Date`, `RegExp`,
 * class instances, NaN, Infinity, -0, or objects with circular references), you **must** provide a custom
 * `cacheKeyFn`. Without one, these values produce unstable or colliding keys (e.g. every
 * `Map` serializes to `{}` via `JSON.stringify`, and circular references fall through to a
 * single-use `uncacheable:<uuid>` key). When `cacheKeyFn` is provided, the default
 * serialization is bypassed and the caller is responsible for producing unique keys.
 *
 * @template T - The type of the resolved promise value
 * @template TArgs - The type of the arguments for the promise function
 * @param promise - A named promise-returning function to be cached. Inline arrow functions are
 *   anonymous and require a `cacheKeyFn` — or assign the arrow to a `const` first so name
 *   inference applies.
 * @param options - Options for keying, invalidation, and error handling
 * @param options.defaultValue - Optional default value to return if the promise rejects
 * @param options.invalidate - Optionally invalidates the cache for the derived key
 * @param options.onError - Optional error handler that receives the error and returns a fallback value
 * @param options.cacheKeyFn - Optional function that receives the same arguments as `fn` and returns a
 *   cache key string. **Required** when `fn` accepts arguments that are not plain POJOs.
 * @returns A wrapper function with the same signature as `fn` that returns cached promises
 */
export function getCachedPromiseWithArgs<T, TArgs extends unknown[]>(
  promise: (...args: TArgs) => Promise<T>,
  options?: GetCachedPromiseWithArgsOptions<T, TArgs>
): (...args: TArgs) => Promise<T> {
  const promiseKey = getCacheKeyFromPromise(promise);
  const baseKey = options?.cacheKeyFn ?? promiseKey;
  if (!baseKey) {
    throw new Error(`getCachedPromiseWithArgs function must be invoked with a named function or cacheKeyFn`);
  }

  function defaultCacheKeyFn(...args: TArgs): string {
    const argsKey = args.map((a) => serializeArg(a, promiseKey ?? '')).join('|');
    return `${promiseKey}:${argsKey}`;
  }

  return (...args: TArgs) => {
    const { cacheKeyFn, ...rest } = options ?? {};
    const cacheKey = cacheKeyFn ? cacheKeyFn(...args) : defaultCacheKeyFn(...args);
    return getCachedPromise(() => promise(...args), { ...rest, cacheKey });
  };
}

/**
 * Removes a cached promise entry so the next call with the same key re-executes the function.
 *
 * The key is derived from the promise function's name and body via {@link getCacheKeyFromPromise},
 * unless an explicit `cacheKey` is provided — in which case it takes precedence and `promise` is
 * only used for type inference.
 *
 * Silently no-ops when no entry exists for the resolved key.
 *
 * @template T - The type of the resolved promise value
 * @param promise - The promise-returning function whose cache entry should be invalidated. Inline
 *   arrow functions are anonymous and require an explicit `cacheKey` — or assign the arrow to a
 *   `const` first so name inference applies.
 * @param options - Optional options object
 * @param options.cacheKey - Optional explicit cache key. When provided, takes precedence over the key
 *   derived from `promise`.
 * @throws {Error} when neither a named function nor a `cacheKey` is supplied
 */
export function invalidateCachedPromise<T>(promise: PromiseFunction<T>, options?: CacheKeyOptions): void {
  const { cacheKey } = options ?? {};
  const key = cacheKey ?? getCacheKeyFromPromise(promise);

  if (!key) {
    throw new Error(`invalidateCachedPromise function must be invoked with a named function or cacheKey`);
  }

  cache.delete(key);
}

/**
 * Replaces the cached promise entry with an already-resolved value, so subsequent reads with the
 * same key return `updatedValue` without re-invoking the function.
 *
 * The key is derived from the promise function's name and body via {@link getCacheKeyFromPromise},
 * unless an explicit `cacheKey` is provided — in which case it takes precedence and `promise` is
 * only used for type inference.
 *
 * Adds the entry even when no prior value was cached for the key.
 *
 * @template T - The type of the resolved promise value
 * @param promise - The promise-returning function whose cache entry should be replaced. Inline
 *   arrow functions are anonymous and require an explicit `cacheKey` — or assign the arrow to a
 *   `const` first so name inference applies.
 * @param updatedValue - The resolved value to cache. Subsequent cache reads with the same
 *   key will resolve to this value without re-invoking the function.
 * @param options - Optional options object
 * @param options.cacheKey - Optional explicit cache key. When provided, takes precedence over the key
 *   derived from `promise`.
 * @throws {Error} when neither a named function nor a `cacheKey` is supplied
 */
export function replaceCachedPromise<T>(promise: PromiseFunction<T>, updatedValue: T, options?: CacheKeyOptions): void {
  const { cacheKey } = options ?? {};
  const key = cacheKey ?? getCacheKeyFromPromise(promise);

  if (!key) {
    throw new Error(`replaceCachedPromise function must be invoked with a named function or cacheKey`);
  }

  cache.set(key, Promise.resolve(updatedValue));
}
