import { LogContext } from '@grafana/faro-web-sdk';

import { createMonitoringLogger, MonitoringLogger } from './logging';

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

let logger: MonitoringLogger;

function getLogger() {
  if (!logger) {
    logger = createMonitoringLogger('get-cached-promise-logs');
  }

  return logger;
}

export function setLogger(override: MonitoringLogger) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setLogger function can only be called from tests.');
  }

  logger = override;
}

function logError({ error, key }: LogErrorArgs): void {
  const err = error instanceof Error ? error : new Error(String(error));

  const context: LogContext = { message: err.message, key };
  if (err.stack) {
    context.stack = err.stack;
  }

  getLogger().logError(new Error(`Something failed while resolving a cached promise`), context);
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
