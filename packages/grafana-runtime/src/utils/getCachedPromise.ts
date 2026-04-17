import { v4 as uuidv4 } from 'uuid';

import { type LogContext } from '@grafana/faro-web-sdk';

import { getLogger } from '../services/logging/registry';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache: Map<string, Promise<any>> = new Map();
export const MAX_CACHE_SIZE = 500;

interface OnErrorArgs {
  error: unknown;
  invalidate: () => void;
}

type PromiseFunction<T> = () => Promise<T>;

interface CachedPromiseOptions<T> {
  cacheKey?: string;
  defaultValue?: T;
  invalidate?: boolean;
  onError?: (args: OnErrorArgs) => Promise<T>;
}

interface CachePromiseWithoutCatchArgs<T> {
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

function logError({ error, key }: LogErrorArgs): void {
  const err = error instanceof Error ? error : new Error(String(error));

  const context: LogContext = { message: err.message, key };
  if (err.stack) {
    context.stack = err.stack;
  }

  getLogger('grafana/runtime.utils.getCachedPromise').logError(
    new Error(`getCachedPromise: Something failed while resolving a cached promise`),
    context
  );
}

function checkCacheSize() {
  if (cache.size <= MAX_CACHE_SIZE) {
    return;
  }
  cache.clear();
}

function addToCache<T>(key: string, cached: Promise<T>) {
  checkCacheSize();
  cache.set(key, cached);
}

function cachePromiseWithoutCatch<T>({ key, promise }: CachePromiseWithoutCatchArgs<T>): Promise<T> {
  const cached = promise();
  addToCache(key, cached);

  return cached;
}

function cachePromiseWithDefaultValue<T>({ defaultValue, key, promise }: CachePromiseWithDefaultArgs<T>): Promise<T> {
  const cached = promise().catch((error) => {
    logError({ error, key });
    cache.delete(key);
    return defaultValue;
  });
  addToCache(key, cached);

  return cached;
}

function cachePromiseWithCallback<T>({ key, promise, onError }: CachePromiseWithCallbackArgs<T>): Promise<T> {
  const invalidate = () => cache.delete(key);
  const cached = promise().catch((error) => onError({ error, invalidate }));
  addToCache(key, cached);

  return cached;
}

/**
 * This utility function will safely handle concurrent requests for the same resource by caching the promise.
 * Caches the result of a promise based on the name of the promise function or cacheKey. If a cached promise exists for the given key,
 * it returns the cached promise. Otherwise, it executes the promise function and caches the result.
 * It also provides options for handling errors, including returning a defaultValue value or invoking a custom error handler.
 * If neither defaultValue nor onError is provided, errors will propagate as usual.
 *
 * @template T - The type of the resolved promise value
 * @param promise - Function that returns the promise to be cached
 * @param options - Options object for error behaviors
 * @param options.cacheKey - Optional cache key to use as key instead of the function name
 * @param options.defaultValue - Optional default value to return if the promise rejects
 * @param options.invalidate - Optionally invalidates the cache for the given function name or cacheKey
 * @param options.onError - Optional error handler that receives the error and an invalidate function
 * @returns A promise that resolves to the cached or newly computed value
 */
export function getCachedPromise<T>(promise: PromiseFunction<T>, options?: CachedPromiseOptions<T>): Promise<T> {
  const { cacheKey, defaultValue, onError, invalidate = false } = options ?? {};
  const key = cacheKey ?? promise.name;

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

  return cachePromiseWithoutCatch({ key, promise });
}

export function invalidateCache() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('invalidateCache function can only be called from tests.');
  }

  cache.clear();
}

/**
 * Serializes a value with a typeof prefix to avoid collisions
 * between different types (e.g. null vs undefined, 1 vs "1").
 *
 * Uses `JSON.stringify` internally, so only JSON-safe values (primitives, plain objects,
 * and arrays) produce stable cache keys. If serialization fails (e.g. circular references),
 * a unique uncacheable key is generated and a warning is logged.
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
 * By default, cache keys are derived by serializing each argument with {@link serializeArg}
 * using `JSON.stringify`. This works reliably for:
 * - Primitives: `string`, `number`, `boolean`, `null`, `undefined`, `bigint`
 * - Plain objects (POJOs) and arrays
 *
 * **If your function accepts non-POJO arguments** (e.g. `Map`, `Set`, `Date`, `RegExp`,
 * class instances, NaN, Infinity, -0, or objects with circular references), you **must** provide a custom
 * `cacheKeyFn`. Without one, these values will either produce unstable keys or bypass
 * the cache entirely. When `cacheKeyFn` is provided, the default serialization is
 * bypassed and the caller is responsible for producing unique keys.
 *
 * @template T - The type of the resolved promise value
 * @template TArgs - The type of the arguments for the promise function
 * @param fn - A named promise-returning function to be cached. Anonymous functions require a `cacheKeyFn`.
 * @param options - Options for error handling and cache invalidation (defaultValue, invalidate, onError)
 * @param options.defaultValue - Optional default value to return if the promise rejects
 * @param options.invalidate - Optionally invalidates the cache for the given function name or cacheKey
 * @param options.onError - Optional error handler that receives the error and an invalidate function
 * @param cacheKeyFn - Optional function that receives the same arguments as `fn` and returns a
 *   cache key string. **Required** when `fn` accepts arguments that are not plain POJOs.
 * @returns A wrapper function with the same signature as `fn` that returns cached promises
 */
export function getCachedPromiseWithArgs<T, TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<T>,
  options?: Pick<CachedPromiseOptions<T>, 'defaultValue' | 'invalidate' | 'onError'>,
  cacheKeyFn?: (...args: TArgs) => string
): (...args: TArgs) => Promise<T> {
  const baseKey = cacheKeyFn ?? fn.name;
  if (!baseKey) {
    throw new Error(`getCachedPromiseWithArgs function must be invoked with a named function or cacheKeyFn`);
  }

  function defaultCacheKeyFn(...args: TArgs): string {
    const argsKey = args.map((a) => serializeArg(a, fn.name)).join('|');
    return `${fn.name}:${argsKey}`;
  }

  return (...args: TArgs) => {
    const cacheKey = cacheKeyFn ? cacheKeyFn(...args) : defaultCacheKeyFn(...args);
    return getCachedPromise(() => fn(...args), { ...options, cacheKey });
  };
}
