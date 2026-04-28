import { getLogger, setLogger } from '../services/logging/registry';

import {
  getCachedPromise,
  getCachedPromiseWithArgs,
  invalidateCache,
  MAX_CACHE_SIZE,
  serializeArg,
} from './getCachedPromise';

const TEST_ASYNC_DELAY = 10;

function simulateOkRequest(): Promise<{ ok: boolean; status: number; statusText: string }> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ ok: true, status: 200, statusText: 'ok' }), TEST_ASYNC_DELAY);
  });
}

function simulateErrorRequest(): Promise<{ ok: boolean; status: number; statusText: string }> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Network Error')), TEST_ASYNC_DELAY);
  });
}

describe('cached promises', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateCache();
    // can't use mockLogger here because that would cause a circular dependency between @grafana/runtime and @grafana/test-utils
    setLogger('grafana/runtime.utils.getCachedPromise', {
      logDebug: jest.fn(),
      logError: jest.fn(),
      logInfo: jest.fn(),
      logMeasurement: jest.fn(),
      logWarning: jest.fn(),
    });
  });

  // heads up that all jest.fn(any function) will get the name 'mockConstructor'
  // so when getCachedPromise adds/looks up the cache key it will add/look up 'mockConstructor'
  describe('getCachedPromise', () => {
    describe('when cache limit is reached', () => {
      test('should clear cache', async () => {
        const entries = Array.from({ length: MAX_CACHE_SIZE + 1 }, (_, i) => i);
        const promises = entries.map((value) => {
          const func = async () => value;
          const cacheKey = `cache-key-${value}`;
          return getCachedPromise(func, { cacheKey });
        });

        await Promise.all(promises);

        // Verify all entries are cached correctly
        const expectPromises = entries.map((value) => {
          const func = async () => 999;
          const cacheKey = `cache-key-${value}`;
          return getCachedPromise(func, { cacheKey }).then((v) => expect(v).toBe(value));
        });

        await Promise.all(expectPromises);

        // Add one more to exceed limit
        await getCachedPromise(simulateOkRequest);

        // Verify that all previous cached are cleared
        const expectClearedPromises = entries.map((value) => {
          const func = async () => 999;
          const cacheKey = `cache-key-${value}`;
          return getCachedPromise(func, { cacheKey }).then((v) => expect(v).toBe(999));
        });

        await Promise.all(expectClearedPromises);
      });
    });

    describe('when called with invalidate option', () => {
      test('should invalidate cache for function name', async () => {
        const actual1 = await getCachedPromise(simulateOkRequest);
        const actual2 = await getCachedPromise(simulateOkRequest, { invalidate: true });
        const actual3 = await getCachedPromise(simulateOkRequest);

        expect(actual1).toStrictEqual({ ok: true, status: 200, statusText: 'ok' });
        expect(actual1).not.toBe(actual2);
        expect(actual2).toStrictEqual({ ok: true, status: 200, statusText: 'ok' });
        expect(actual3).toBe(actual2);
      });

      test('should invalidate cache for cacheKey', async () => {
        const actual1 = await getCachedPromise(simulateOkRequest, { cacheKey: 'the-key' });
        const actual2 = await getCachedPromise(simulateOkRequest, { cacheKey: 'the-key', invalidate: true });
        const actual3 = await getCachedPromise(simulateOkRequest, { cacheKey: 'the-key' });

        expect(actual1).toStrictEqual({ ok: true, status: 200, statusText: 'ok' });
        expect(actual1).not.toBe(actual2);
        expect(actual2).toStrictEqual({ ok: true, status: 200, statusText: 'ok' });
        expect(actual3).toBe(actual2);
      });

      test('should return correct values when called concurrently', async () => {
        const otherFunction = async () => 2;

        const promise1 = getCachedPromise(simulateOkRequest, { cacheKey: 'the-key', invalidate: true });
        const promise2 = getCachedPromise(otherFunction, { cacheKey: 'the-key', invalidate: true });

        const [actual1, actual2] = await Promise.all([promise1, promise2]);

        expect(actual1).toStrictEqual({ ok: true, status: 200, statusText: 'ok' });
        expect(actual2).toBe(2);
      });
    });

    describe('when called with different functions', () => {
      test('should cache each function name separately', async () => {
        const otherFunction = async () => 2;
        const actual1 = await getCachedPromise(simulateOkRequest);
        const actual2 = await getCachedPromise(otherFunction);

        expect(actual1).toStrictEqual({ ok: true, status: 200, statusText: 'ok' });
        expect(actual2).toBe(2);
      });

      test('should use cacheKey as key when supplied', async () => {
        const otherFunction = async () => 2;
        const actual1 = await getCachedPromise(simulateOkRequest);
        const actual2 = await getCachedPromise(otherFunction, { cacheKey: 'simulateOkRequest' });

        expect(actual1).toStrictEqual({ ok: true, status: 200, statusText: 'ok' });
        expect(actual2).toBe(actual1);
      });
    });

    describe('when called with anonymous functions', () => {
      test('should throw an error', async () => {
        await expect(getCachedPromise(async () => 2)).rejects.toThrow(
          `getCachedPromise function must be invoked with a named function or cacheKey`
        );
      });

      test('should not throw an error if a cacheKey is supplied', async () => {
        const actual = await getCachedPromise(async () => 2, { cacheKey: 'a-cache-key' });

        expect(actual).toBe(2);
      });
    });

    describe('when called without defaultValue and onError', () => {
      test('should cache promise correctly', async () => {
        const promise = jest.fn(simulateOkRequest);
        const promise2 = jest.fn(simulateErrorRequest);

        const actual1 = await getCachedPromise(promise);
        const actual2 = await getCachedPromise(promise2);

        expect(actual1).toBe(actual2);
        expect(promise).toHaveBeenCalledTimes(1);
        expect(promise2).toHaveBeenCalledTimes(0);
      });

      test('should return inflight promise', async () => {
        const promise = jest.fn(simulateOkRequest);
        const promiseReject = jest.fn(simulateErrorRequest);

        const promise1 = getCachedPromise(promise);
        const promise2 = getCachedPromise(promiseReject);

        const [actual1, actual2] = await Promise.all([promise1, promise2]);

        expect(actual1).toBe(actual2);
        expect(promise).toHaveBeenCalledTimes(1);
      });

      test('should bubble up errors', async () => {
        const promise = jest.fn(simulateErrorRequest);

        await expect(getCachedPromise(promise)).rejects.toThrow('Network Error');

        expect(promise).toHaveBeenCalledTimes(1);
      });

      test('should invalidate cache on errors', async () => {
        const promise = jest.fn(simulateErrorRequest);
        const promise2 = jest.fn(simulateOkRequest);

        await expect(getCachedPromise(promise)).rejects.toThrow('Network Error');

        const actual = await getCachedPromise(promise2);

        expect(actual).toStrictEqual({ ok: true, status: 200, statusText: 'ok' });
        expect(promise).toHaveBeenCalledTimes(1);
        expect(promise2).toHaveBeenCalledTimes(1);
      });

      test('should log errors', async () => {
        const promise = jest.fn(simulateErrorRequest);

        await expect(getCachedPromise(promise)).rejects.toThrow('Network Error');

        const logErrorMock = getLogger('grafana/runtime.utils.getCachedPromise').logError as jest.Mock;
        expect(logErrorMock).toHaveBeenCalledTimes(1);
        expect(logErrorMock).toHaveBeenCalledWith(
          new Error(`getCachedPromise: Something failed while resolving a cached promise`),
          {
            stack: expect.any(String),
            message: 'Network Error',
            key: 'mockConstructor',
          }
        );
        expect(logErrorMock.mock.calls[0][0].cause).toStrictEqual(new Error('Network Error'));
      });

      test('should log non-Error thrown values', async () => {
        const promise = jest.fn(() => Promise.reject('string error'));

        await expect(getCachedPromise(promise)).rejects.toBe('string error');

        const logErrorMock = getLogger('grafana/runtime.utils.getCachedPromise').logError as jest.Mock;
        expect(logErrorMock).toHaveBeenCalledTimes(1);
        expect(logErrorMock).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({ message: 'string error', key: 'mockConstructor' })
        );
        expect(logErrorMock.mock.calls[0][0].cause).toBe('string error');
      });
    });

    describe('when called with defaultValue but without onError', () => {
      test('should cache promise correctly', async () => {
        const promise = jest.fn(simulateOkRequest);
        const promise2 = jest.fn(simulateErrorRequest);

        const actual1 = await getCachedPromise(promise, {
          defaultValue: { ok: false, status: 500, statusText: 'Internal Server Error' },
        });
        const actual2 = await getCachedPromise(promise2);

        expect(actual1).toBe(actual2);
        expect(promise).toHaveBeenCalledTimes(1);
        expect(promise2).toHaveBeenCalledTimes(0);
      });

      test('should return inflight promise', async () => {
        const promise = jest.fn(simulateOkRequest);

        const promise1 = getCachedPromise(promise, {
          defaultValue: { ok: false, status: 500, statusText: 'Internal Server Error' },
        });
        const promise2 = getCachedPromise(promise, {
          defaultValue: { ok: false, status: 500, statusText: 'Internal Server Error' },
        });

        const [actual1, actual2] = await Promise.all([promise1, promise2]);

        expect(actual1).toBe(actual2);
        expect(promise).toHaveBeenCalledTimes(1);
      });

      test('should not bubble up errors but handle them and log errors', async () => {
        const promise = jest.fn(simulateErrorRequest);

        const actual = await getCachedPromise(promise, {
          defaultValue: { ok: false, status: 500, statusText: 'Internal Server Error' },
        });

        expect(actual).toStrictEqual({ ok: false, status: 500, statusText: 'Internal Server Error' });
        expect(promise).toHaveBeenCalledTimes(1);
        const logErrorMock = getLogger('grafana/runtime.utils.getCachedPromise').logError as jest.Mock;
        expect(logErrorMock).toHaveBeenCalledTimes(1);
        expect(logErrorMock).toHaveBeenCalledWith(
          new Error(`getCachedPromise: Something failed while resolving a cached promise`),
          {
            stack: expect.any(String),
            message: 'Network Error',
            key: 'mockConstructor',
          }
        );
        expect(logErrorMock.mock.calls[0][0].cause).toStrictEqual(new Error('Network Error'));
      });

      test('should invalidate cache when something errors', async () => {
        const promise = jest.fn(simulateErrorRequest);
        const promise2 = jest.fn(simulateOkRequest);

        const actual1 = await getCachedPromise(promise, {
          defaultValue: { ok: false, status: 500, statusText: 'Internal Server Error' },
        });

        const actual2 = await getCachedPromise(promise2);

        expect(actual1).toStrictEqual({ ok: false, status: 500, statusText: 'Internal Server Error' });
        expect(actual2).toStrictEqual({ ok: true, status: 200, statusText: 'ok' });
        expect(promise).toHaveBeenCalledTimes(1);
        expect(promise2).toHaveBeenCalledTimes(1); // because the cache is invalidated on error then promise2 is called
      });
    });

    describe('when called with onError but without defaultValue', () => {
      test('should cache promise correctly', async () => {
        const promise = jest.fn(simulateOkRequest);
        const promise2 = jest.fn(simulateErrorRequest);

        const actual1 = await getCachedPromise(promise, {
          onError: async () => ({ ok: false, status: 500, statusText: 'Internal Server Error' }),
        });
        const actual2 = await getCachedPromise(promise2);

        expect(actual1).toBe(actual2);
        expect(promise).toHaveBeenCalledTimes(1);
        expect(promise2).toHaveBeenCalledTimes(0);
      });

      test('should return inflight promise', async () => {
        const promise = jest.fn(simulateOkRequest);

        const promise1 = getCachedPromise(promise, {
          onError: async () => ({ ok: false, status: 500, statusText: 'Internal Server Error' }),
        });
        const promise2 = getCachedPromise(promise, {
          onError: async () => ({ ok: false, status: 500, statusText: 'Internal Server Error' }),
        });

        const [actual1, actual2] = await Promise.all([promise1, promise2]);

        expect(actual1).toBe(actual2);
        expect(promise).toHaveBeenCalledTimes(1);
      });

      test('should not bubble up errors but call onError callback', async () => {
        const promise = jest.fn(simulateErrorRequest);
        const onError = jest.fn(() => Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error' }));

        const actual = await getCachedPromise(promise, { onError });

        expect(actual).toStrictEqual({ ok: false, status: 500, statusText: 'Internal Server Error' });
        expect(promise).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith({ error: new Error('Network Error') });
      });

      test('should always invalidate cache on error', async () => {
        const promise = jest.fn(simulateErrorRequest);
        const promise2 = jest.fn(simulateOkRequest);

        const actual1 = await getCachedPromise(promise, {
          onError: async ({ error }) => {
            expect(error).toStrictEqual(new Error('Network Error'));
            return { ok: false, status: 500, statusText: 'Network Error' };
          },
        });

        const actual2 = await getCachedPromise(promise2);

        expect(actual1).toStrictEqual({ ok: false, status: 500, statusText: 'Network Error' });
        expect(actual2).toStrictEqual({ ok: true, status: 200, statusText: 'ok' });
        expect(promise).toHaveBeenCalledTimes(1);
        expect(promise2).toHaveBeenCalledTimes(1); // cache is always invalidated on error
      });

      test('should log errors', async () => {
        const promise = jest.fn(simulateErrorRequest);

        await getCachedPromise(promise, {
          onError: async () => ({ ok: false, status: 500, statusText: 'Internal Server Error' }),
        });

        const logErrorMock = getLogger('grafana/runtime.utils.getCachedPromise').logError as jest.Mock;
        expect(logErrorMock).toHaveBeenCalledTimes(1);
        expect(logErrorMock).toHaveBeenCalledWith(
          new Error(`getCachedPromise: Something failed while resolving a cached promise`),
          {
            stack: expect.any(String),
            message: 'Network Error',
            key: 'mockConstructor',
          }
        );
        expect(logErrorMock.mock.calls[0][0].cause).toStrictEqual(new Error('Network Error'));
      });

      test('should propagate error when onError callback throws', async () => {
        const promise = jest.fn(simulateErrorRequest);

        await expect(
          getCachedPromise(promise, {
            onError: async () => {
              throw new Error('onError failed');
            },
          })
        ).rejects.toThrow('onError failed');

        // Error should still be logged
        const logErrorMock = getLogger('grafana/runtime.utils.getCachedPromise').logError as jest.Mock;
        expect(logErrorMock).toHaveBeenCalledTimes(1);

        // Cache should still be invalidated
        const promise2 = jest.fn(simulateOkRequest);
        const actual = await getCachedPromise(promise2);
        expect(actual).toStrictEqual({ ok: true, status: 200, statusText: 'ok' });
        expect(promise2).toHaveBeenCalledTimes(1);
      });
    });
  });

  // heads up that all jest.fn(any function) will get the name 'mockConstructor'
  // so when getCachedPromiseWithArgs adds/looks up the cache key it will add/look up 'mockConstructor'
  describe('getCachedPromiseWithArgs', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should cache based on arguments', async () => {
      const fn = jest.fn(async (id: string) => `result-${id}`);
      const cached = getCachedPromiseWithArgs(fn);

      const actual1 = await cached('a');
      const actual2 = await cached('a');

      expect(actual1).toBe('result-a');
      expect(actual1).toBe(actual2);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should cache different arguments separately', async () => {
      const fn = jest.fn(async (id: string) => `result-${id}`);
      const cached = getCachedPromiseWithArgs(fn);

      const actual1 = await cached('a');
      const actual2 = await cached('a');
      const actual3 = await cached('b');
      const actual4 = await cached('b');

      expect(actual1).toBe('result-a');
      expect(actual1).toBe(actual2);
      expect(actual3).toBe('result-b');
      expect(actual3).toBe(actual4);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test('should support multiple arguments', async () => {
      const fn = jest.fn(async (a: string, b: number) => `${a}-${b}`);
      const cached = getCachedPromiseWithArgs(fn);

      const actual1 = await cached('x', 1);
      const actual2 = await cached('x', 1);
      const actual3 = await cached('x', 2);
      const actual4 = await cached('x', 2);

      expect(actual1).toBe('x-1');
      expect(actual1).toBe(actual2);
      expect(actual3).toBe('x-2');
      expect(actual3).toBe(actual4);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test('should return inflight promise for same arguments', async () => {
      const fn = jest.fn(
        (id: string) => new Promise<string>((resolve) => setTimeout(() => resolve(`result-${id}`), TEST_ASYNC_DELAY))
      );
      const cached = getCachedPromiseWithArgs(fn);

      const promise1 = cached('a');
      const promise2 = cached('a');

      jest.runAllTimers();

      const [actual1, actual2] = await Promise.all([promise1, promise2]);

      expect(actual1).toBe(actual2);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should support defaultValue option', async () => {
      const fn = jest.fn(async (_id: string): Promise<string> => {
        throw new Error('fail');
      });
      const cached = getCachedPromiseWithArgs(fn, { defaultValue: 'fallback' });

      const actual = await cached('a');

      expect(actual).toBe('fallback');
      expect(getLogger('grafana/runtime.utils.getCachedPromise').logError).toHaveBeenCalledTimes(1);
    });

    test('should support onError option', async () => {
      const fn = jest.fn(async (_id: string): Promise<string> => {
        throw new Error('fail');
      });
      const onError = jest.fn(async () => 'recovered');
      const cached = getCachedPromiseWithArgs(fn, { onError });

      const actual = await cached('a');

      expect(actual).toBe('recovered');
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith({ error: new Error('fail') });
    });

    test('should support invalidate option', async () => {
      let callCount = 0;
      async function counter(id: string) {
        callCount++;
        return `${id}-${callCount}`;
      }

      const cached = getCachedPromiseWithArgs(counter);
      const cachedInvalidate = getCachedPromiseWithArgs(counter, { invalidate: true });

      const actual1 = await cached('a');
      const actual2 = await cachedInvalidate('a');
      const actual3 = await cached('a');

      expect(actual1).toBe('a-1');
      expect(actual2).toBe('a-2');
      expect(actual2).toBe(actual3);
    });

    test('should propagate errors when no defaultValue or onError is provided', async () => {
      const fn = jest.fn(async (_id: string): Promise<string> => {
        throw new Error('Network Error');
      });
      const cached = getCachedPromiseWithArgs(fn);

      await expect(cached('a')).rejects.toThrow('Network Error');
    });

    test('should throw when called with an anonymous function and no cacheKeyFn', () => {
      expect(() => getCachedPromiseWithArgs(async (_id: string) => `result-${_id}`)).toThrow(
        'getCachedPromiseWithArgs function must be invoked with a named function or cacheKeyFn'
      );
    });

    test('should not throw when called with an anonymous function and a cacheKeyFn', async () => {
      const fn = async (id: string) => `result-${id}`;
      const cached = getCachedPromiseWithArgs(fn, undefined, (id) => `custom:${id}`);

      const actual = await cached('a');
      expect(actual).toBe('result-a');
    });

    test('should cache different named functions independently even with same args', async () => {
      async function fetchUser(id: string) {
        return `user-${id}`;
      }

      async function fetchOrder(id: string) {
        return `order-${id}`;
      }

      const cachedFetchUser = getCachedPromiseWithArgs(fetchUser);
      const cachedFetchOrder = getCachedPromiseWithArgs(fetchOrder);

      const user = await cachedFetchUser('123');
      const order = await cachedFetchOrder('123');

      expect(user).toBe('user-123');
      expect(order).toBe('order-123');
    });

    test('should forward arguments to the underlying function', async () => {
      const fn = jest.fn(async (a: string, b: number, c: boolean) => `${a}-${b}-${c}`);
      const cached = getCachedPromiseWithArgs(fn);

      await cached('hello', 42, true);

      expect(fn).toHaveBeenCalledWith('hello', 42, true);
    });

    test('should not collide when args contain the separator character', async () => {
      const fn = jest.fn(async (...args: string[]) => args.join(','));
      const cached = getCachedPromiseWithArgs(fn);

      const twoArgs = await cached('a', 'b');
      const oneArgWithPipe = await cached('a|b');

      expect(twoArgs).toBe('a,b');
      expect(oneArgWithPipe).toBe('a|b');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test('should only invalidate the cache for the specific args', async () => {
      let callCount = 0;
      async function counter(id: string) {
        callCount++;
        return `${id}-${callCount}`;
      }

      const cached = getCachedPromiseWithArgs(counter);
      const cachedInvalidate = getCachedPromiseWithArgs(counter, { invalidate: true });

      const a1 = await cached('a');
      const b1 = await cached('b');

      // Invalidate only 'a', 'b' should remain cached
      await cachedInvalidate('a');

      const a2 = await cached('a');
      const b2 = await cached('b');

      expect(a1).toBe('a-1');
      expect(b1).toBe('b-2');
      expect(a2).toBe('a-3'); // call 3: cachedInvalidate('a') invalidated + re-fetched
      expect(b2).toBe(b1); // 'b' was not invalidated, still cached
    });

    describe('when called with cacheKeyFn', () => {
      test('should use cacheKeyFn to generate cache keys', async () => {
        const fn = jest.fn(async (id: string) => `result-${id}`);
        const cached = getCachedPromiseWithArgs(fn, undefined, (id) => `custom:${id}`);

        const actual1 = await cached('a');
        const actual2 = await cached('a');

        expect(actual1).toBe('result-a');
        expect(actual1).toBe(actual2);
        expect(fn).toHaveBeenCalledTimes(1);
      });

      test('should cache separately when cacheKeyFn returns different keys', async () => {
        const fn = jest.fn(async (id: string) => `result-${id}`);
        const cached = getCachedPromiseWithArgs(fn, undefined, (id) => `custom:${id}`);

        const actual1 = await cached('a');
        const actual2 = await cached('b');

        expect(actual1).toBe('result-a');
        expect(actual2).toBe('result-b');
        expect(fn).toHaveBeenCalledTimes(2);
      });

      test('should allow unsupported types when cacheKeyFn is provided', async () => {
        const fn = jest.fn(async (filter: RegExp) => `matched-${filter.source}`);
        const cached = getCachedPromiseWithArgs(fn, undefined, (filter) => `regex:${filter.source}:${filter.flags}`);

        const actual1 = await cached(/foo/i);
        const actual2 = await cached(/foo/i);
        const actual3 = await cached(/bar/g);

        expect(actual1).toBe('matched-foo');
        expect(actual1).toBe(actual2);
        expect(actual3).toBe('matched-bar');
        expect(fn).toHaveBeenCalledTimes(2);
        // No logError calls since cacheKeyFn bypasses serialization
        expect(getLogger('grafana/runtime.utils.getCachedPromise').logError).not.toHaveBeenCalled();
      });

      test('should support invalidate option with cacheKeyFn', async () => {
        let callCount = 0;
        async function fetchData(id: string) {
          callCount++;
          return `data-${id}-${callCount}`;
        }

        const cached = getCachedPromiseWithArgs(fetchData, undefined, (id) => `custom:${id}`);
        const cachedInvalidate = getCachedPromiseWithArgs(fetchData, { invalidate: true }, (id) => `custom:${id}`);

        const a1 = await cached('a');
        const b1 = await cached('b');

        // Invalidate only 'a' via cacheKeyFn, 'b' should remain cached
        await cachedInvalidate('a');

        const a2 = await cached('a');
        const b2 = await cached('b');

        expect(a1).toBe('data-a-1');
        expect(b1).toBe('data-b-2');
        expect(a2).toBe('data-a-3'); // invalidated + re-fetched
        expect(b2).toBe(b1); // 'b' was not invalidated, still cached
      });

      test('should support onError option with cacheKeyFn', async () => {
        const fn = jest.fn(async (_id: string): Promise<string> => {
          throw new Error('fail');
        });
        const onError = jest.fn(async () => 'recovered');
        const cached = getCachedPromiseWithArgs(fn, { onError }, (id) => `custom:${id}`);

        const actual = await cached('a');

        expect(actual).toBe('recovered');
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith({ error: new Error('fail') });

        // Cache is always invalidated on error, so a new call should re-fetch
        fn.mockResolvedValueOnce('fresh');
        const actual2 = await cached('a');
        expect(actual2).toBe('fresh');
        expect(fn).toHaveBeenCalledTimes(2);
      });

      test('should isolate cache between different cacheKeyFn instances for the same function', async () => {
        let callCount = 0;
        async function fetchData(id: string) {
          callCount++;
          return `data-${id}-${callCount}`;
        }

        const cachedA = getCachedPromiseWithArgs(fetchData, undefined, (id) => `ns-a:${id}`);
        const cachedB = getCachedPromiseWithArgs(fetchData, undefined, (id) => `ns-b:${id}`);

        const resultA = await cachedA('1');
        const resultB = await cachedB('1');

        expect(resultA).toBe('data-1-1');
        expect(resultB).toBe('data-1-2');
      });
    });
  });

  describe('serializeArg', () => {
    test('should serialize string arguments', () => {
      expect(serializeArg('a', 'test')).toBe('string:"a"');
    });

    test('should serialize number arguments', () => {
      expect(serializeArg(1, 'test')).toBe('number:1');
    });

    test('should serialize boolean arguments', () => {
      expect(serializeArg(true, 'test')).toBe('boolean:true');
    });

    test('should serialize object arguments', () => {
      expect(serializeArg({ id: 1 }, 'test')).toBe('object:{"id":1}');
    });

    test('should serialize array arguments distinctly from objects', () => {
      expect(serializeArg([1, 2], 'test')).toBe('object:[1,2]');
      expect(serializeArg({ 0: 1, 1: 2 }, 'test')).toBe('object:{"0":1,"1":2}');
      expect(serializeArg([1, 2], 'test')).not.toBe(serializeArg({ 0: 1, 1: 2 }, 'test'));
    });

    test('should produce different keys for objects with different key order', () => {
      const keyAB = serializeArg({ a: 1, b: 2 }, 'test');
      const keyBA = serializeArg({ b: 2, a: 1 }, 'test');

      // JSON.stringify preserves insertion order, so different key order = different cache key
      expect(keyAB).toBe('object:{"a":1,"b":2}');
      expect(keyBA).toBe('object:{"b":2,"a":1}');
      expect(keyAB).not.toBe(keyBA);
    });

    test('should serialize null and undefined distinctly', () => {
      expect(serializeArg(null, 'test')).toBe('object:null');
      expect(serializeArg(undefined, 'test')).toBe('undefined:undefined');
      expect(serializeArg(null, 'test')).not.toBe(serializeArg(undefined, 'test'));
    });

    test('should distinguish number from string with same value', () => {
      expect(serializeArg(1, 'test')).toBe('number:1');
      expect(serializeArg('1', 'test')).toBe('string:"1"');
      expect(serializeArg(1, 'test')).not.toBe(serializeArg('1', 'test'));
    });

    test('should can not distinguish NaN, Infinity, -Infinity and -0', () => {
      expect(serializeArg(NaN, 'test')).toBe('number:null');
      expect(serializeArg(Infinity, 'test')).toBe('number:null');
      expect(serializeArg(-Infinity, 'test')).toBe('number:null');
      expect(serializeArg(-0, 'test')).toBe('number:0');
      expect(serializeArg(0, 'test')).toBe('number:0');
    });

    test('should not be able to serialize bigint arguments', () => {
      expect(serializeArg(BigInt(42), 'test')).toMatch(/^uncacheable:/);
    });

    test.each([
      { name: 'Map', value: new Map() },
      { name: 'Set', value: new Set() },
      { name: 'WeakMap', value: new WeakMap() },
      { name: 'WeakSet', value: new WeakSet() },
      { name: 'Error', value: new Error('test') },
      { name: 'RegExp', value: /test/ },
      { name: 'RegExp', value: new RegExp('test') },
      { name: 'Promise', value: Promise.resolve() },
    ])('should return object:{} for unsupported type: $name', ({ name, value }) => {
      const key = serializeArg(value, 'test');

      expect(key).toBe('object:{}');
    });

    test('should return a unique uncacheable key when JSON.stringify fails', () => {
      const circular: Record<string, unknown> = { name: 'a' };
      circular.self = circular;

      const keyA = serializeArg(circular, 'test');
      const keyB = serializeArg(circular, 'test');

      expect(keyA).toMatch(/^uncacheable:/);
      expect(keyB).toMatch(/^uncacheable:/);
      expect(keyA).not.toBe(keyB);
      expect(getLogger('grafana/runtime.utils.getCachedPromise').logError).toHaveBeenCalledTimes(2);
      expect(getLogger('grafana/runtime.utils.getCachedPromise').logError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'getCachedPromiseWithArgs: serializeArg failed' }),
        expect.objectContaining({ baseKey: 'test' })
      );
    });
  });
});
