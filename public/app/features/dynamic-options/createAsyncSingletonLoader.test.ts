import { createAsyncSingletonLoader } from './createAsyncSingletonLoader';

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

describe('createAsyncSingletonLoader', () => {
  it('reuses the same in-flight promise', () => {
    const deferred = createDeferred<string>();
    const fetcher = jest.fn(() => deferred.promise);
    const loader = createAsyncSingletonLoader(fetcher);

    const firstLoad = loader.load();
    const secondLoad = loader.load();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(firstLoad).toBe(secondLoad);
  });

  it('marks itself loaded after the first successful resolution', async () => {
    const fetcher = jest.fn(async () => 'value');
    const loader = createAsyncSingletonLoader(fetcher);

    expect(loader.isLoaded()).toBe(false);

    await loader.load();

    expect(loader.isLoaded()).toBe(true);
  });

  it('runs onResolve once and exposes resolved value', async () => {
    const fetcher = jest.fn(async () => ({ value: 42 }));
    const onResolve = jest.fn();
    const loader = createAsyncSingletonLoader(fetcher, onResolve);

    const value = await loader.load();
    await loader.load();

    expect(value).toEqual({ value: 42 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve).toHaveBeenCalledWith({ value: 42 });
  });

  it('reset clears cache and loaded state', async () => {
    const fetcher = jest.fn<Promise<number>, []>().mockResolvedValueOnce(1).mockResolvedValueOnce(2);

    const loader = createAsyncSingletonLoader(fetcher);

    await expect(loader.load()).resolves.toBe(1);
    expect(loader.isLoaded()).toBe(true);

    loader.reset();

    expect(loader.isLoaded()).toBe(false);
    await expect(loader.load()).resolves.toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
