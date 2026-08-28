import {
  getKubernetesFilters,
  getKubernetesFiltersVersion,
  normalizeKubernetesFilters,
  resetKubernetesFilters,
  saveKubernetesFilters,
  subscribeKubernetesFilters,
} from './kubernetesFilters';

// bootData.user.isSignedIn is falsy under jest, so UserStorage persists via window.localStorage.
beforeEach(() => {
  window.localStorage.clear();
  resetKubernetesFilters();
});

describe('normalizeKubernetesFilters', () => {
  it.each([
    { desc: 'null', input: null },
    { desc: 'a string', input: 'cluster' },
    { desc: 'a number', input: 42 },
    { desc: 'undefined', input: undefined },
  ])('returns empty filters for $desc', ({ input }) => {
    expect(normalizeKubernetesFilters(input)).toStrictEqual({});
  });

  it('trims the cluster and drops it when blank', () => {
    expect(normalizeKubernetesFilters({ cluster: '  prod  ' })).toStrictEqual({ cluster: 'prod' });
    expect(normalizeKubernetesFilters({ cluster: '   ' })).toStrictEqual({});
    expect(normalizeKubernetesFilters({ cluster: 7 })).toStrictEqual({});
  });

  it('trims, dedupes, and drops non-string namespaces preserving first-seen order', () => {
    expect(
      normalizeKubernetesFilters({ namespaces: [' team-b ', 'team-a', 'team-b', 3, '', '  ', 'team-a'] })
    ).toStrictEqual({ namespaces: ['team-b', 'team-a'] });
  });

  it('omits the namespaces key entirely when nothing survives', () => {
    expect(normalizeKubernetesFilters({ namespaces: ['', 4, null] })).toStrictEqual({});
    expect(normalizeKubernetesFilters({ namespaces: 'default' })).toStrictEqual({});
  });
});

describe('kubernetes filters storage', () => {
  it('round-trips a save through storage, normalized', async () => {
    await saveKubernetesFilters({ cluster: ' prod ', namespaces: ['team-a', 'team-a', ' team-b ', ''] });
    // Drop the in-memory snapshot so the read below proves persistence, not the cache.
    resetKubernetesFilters();
    await expect(getKubernetesFilters()).resolves.toStrictEqual({ cluster: 'prod', namespaces: ['team-a', 'team-b'] });
  });

  it('reads a corrupt stored value as no filters', async () => {
    await saveKubernetesFilters({ cluster: 'prod' });
    // Key-agnostic corruption: find whatever key the storage layer wrote and break it.
    const key = Object.keys(window.localStorage).find((k) => k.includes('kubernetes-filters'));
    expect(key).toBeDefined();
    window.localStorage.setItem(key!, '{bad');
    resetKubernetesFilters();
    await expect(getKubernetesFilters()).resolves.toStrictEqual({});
  });

  it('bumps the version and notifies subscribers on save; unsubscribe stops notifications', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeKubernetesFilters(listener);
    expect(getKubernetesFiltersVersion()).toBe(0);

    await saveKubernetesFilters({ cluster: 'prod' });
    expect(getKubernetesFiltersVersion()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await saveKubernetesFilters({ cluster: 'staging' });
    expect(getKubernetesFiltersVersion()).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps the previous snapshot, version, and silence when the save fails', async () => {
    await saveKubernetesFilters({ cluster: 'prod' });
    const listener = jest.fn();
    subscribeKubernetesFilters(listener);

    // store.set assigns storage[key] directly, so a Storage.prototype.setItem spy never fires;
    // a throwing Proxy over localStorage is the reliable failure injection.
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: new Proxy(original, {
        set() {
          throw new Error('quota exceeded');
        },
      }),
    });
    try {
      await expect(saveKubernetesFilters({ cluster: 'other' })).rejects.toThrow('quota exceeded');
    } finally {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: original });
    }

    expect(getKubernetesFiltersVersion()).toBe(1);
    expect(listener).not.toHaveBeenCalled();
    await expect(getKubernetesFilters()).resolves.toStrictEqual({ cluster: 'prod' });
  });
});
