import { EnrichmentCache } from './enrichmentCache';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('EnrichmentCache', () => {
  it('caches a resolved value and does not re-fetch it', async () => {
    const fetchFn = jest.fn().mockResolvedValue('value-a');
    const cache = new EnrichmentCache(fetchFn);

    cache.request('a');
    await Promise.resolve();
    await Promise.resolve();

    expect(cache.get('a')).toBe('value-a');
    expect(fetchFn).toHaveBeenCalledTimes(1);

    cache.request('a');
    await Promise.resolve();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('never issues more than maxConcurrency fetches at once', async () => {
    const pending: Array<{ resolve: (v: string) => void }> = [];
    const fetchFn = jest.fn().mockImplementation((key: string) => {
      const d = deferred<string>();
      pending.push(d);
      return d.promise;
    });
    const cache = new EnrichmentCache(fetchFn, 2);

    for (const key of ['a', 'b', 'c', 'd']) {
      cache.request(key);
    }

    // Only the concurrency limit's worth of fetches have actually started.
    expect(fetchFn).toHaveBeenCalledTimes(2);

    pending[0].resolve('value-a');
    await Promise.resolve();
    await Promise.resolve();

    // Resolving one frees a slot for the next queued key.
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('a failed lookup does not poison the cache - a later request retries it', async () => {
    const fetchFn = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('value-a');
    const cache = new EnrichmentCache(fetchFn);

    cache.request('a');
    await Promise.resolve();
    await Promise.resolve();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.isPending('a')).toBe(false);

    cache.request('a');
    await Promise.resolve();
    await Promise.resolve();
    expect(cache.get('a')).toBe('value-a');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('notifies subscribers only once the fetch resolves', async () => {
    const fetchFn = jest.fn().mockResolvedValue('value-a');
    const cache = new EnrichmentCache(fetchFn);
    const listener = jest.fn();
    cache.subscribe(listener);

    cache.request('a');
    expect(listener).not.toHaveBeenCalled();

    await Promise.resolve();
    await Promise.resolve();
    expect(listener).toHaveBeenCalledWith('a');
  });
});
