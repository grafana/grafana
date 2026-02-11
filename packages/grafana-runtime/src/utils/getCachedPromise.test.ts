import { getCachedPromise, invalidateCache, MAX_CACHE_SIZE, setLogger } from './getCachedPromise';
import { MonitoringLogger } from './logging';

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

let logger: MonitoringLogger;

beforeEach(() => {
  jest.clearAllMocks();
  invalidateCache();
  logger = {
    logDebug: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn(),
    logMeasurement: jest.fn(),
    logWarning: jest.fn(),
  };
  setLogger(logger);
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

    test('should not invalidate cache on errors', async () => {
      const promise = jest.fn(simulateErrorRequest);
      const promise2 = jest.fn(simulateOkRequest);

      await expect(getCachedPromise(promise)).rejects.toThrow('Network Error');
      await expect(getCachedPromise(promise2)).rejects.toThrow('Network Error');

      expect(promise).toHaveBeenCalledTimes(1);
      expect(promise2).toHaveBeenCalledTimes(0);
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
      expect(logger.logError).toHaveBeenCalledTimes(1);
      expect(logger.logError).toHaveBeenCalledWith(new Error(`Something failed while resolving a cached promise`), {
        stack: expect.any(String),
        message: 'Network Error',
        key: 'mockConstructor',
      });
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
      expect(onError).toHaveBeenCalledWith({ error: new Error('Network Error'), invalidate: expect.any(Function) });
    });

    test('should invalidate cache when calling invalidate function', async () => {
      const promise = jest.fn(simulateErrorRequest);
      const promise2 = jest.fn(simulateOkRequest);

      const actual1 = await getCachedPromise(promise, {
        onError: async ({ error, invalidate }) => {
          expect(error).toStrictEqual(new Error('Network Error'));
          invalidate();
          return { ok: false, status: 500, statusText: 'Network Error' };
        },
      });

      const actual2 = await getCachedPromise(promise2);

      expect(actual1).toStrictEqual({ ok: false, status: 500, statusText: 'Network Error' });
      expect(actual2).toStrictEqual({ ok: true, status: 200, statusText: 'ok' });
      expect(promise).toHaveBeenCalledTimes(1);
      expect(promise2).toHaveBeenCalledTimes(1); // because the cache is invalidated on error then promise2 is called
    });

    test('should not invalidate cache if invalidate function is not called', async () => {
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
      expect(actual2).toBe(actual1);
      expect(promise).toHaveBeenCalledTimes(1);
      expect(promise2).toHaveBeenCalledTimes(0); // because the cache is not invalidated on error
    });
  });
});
