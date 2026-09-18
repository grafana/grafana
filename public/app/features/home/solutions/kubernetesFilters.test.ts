// The store constructs its UserStorage at module load, so the mock must exist before the import.
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  UserStorage: jest.fn().mockImplementation(() => ({ getItem: mockGetItem, setItem: mockSetItem })),
}));

import {
  getKubernetesFilters,
  getKubernetesFiltersVersion,
  hasKubernetesFilters,
  normalizeKubernetesFilters,
  resetKubernetesFilters,
  saveKubernetesFilters,
  subscribeKubernetesFilters,
} from './kubernetesFilters';

beforeEach(() => {
  mockGetItem.mockReset().mockResolvedValue(null);
  mockSetItem.mockReset().mockResolvedValue(undefined);
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

  it.each(['namespaces', 'nodes'] as const)(
    'trims, dedupes, and drops non-string %s preserving first-seen order',
    (key) => {
      expect(normalizeKubernetesFilters({ [key]: [' b ', 'a', 'b', 3, '', '  ', 'a'] })).toStrictEqual({
        [key]: ['b', 'a'],
      });
    }
  );

  it.each(['namespaces', 'nodes'] as const)('omits the %s key entirely when nothing survives', (key) => {
    expect(normalizeKubernetesFilters({ [key]: ['', 4, null] })).toStrictEqual({});
    expect(normalizeKubernetesFilters({ [key]: 'default' })).toStrictEqual({});
  });
});

describe('hasKubernetesFilters', () => {
  it.each([
    { desc: 'a cluster', filters: { cluster: 'prod' } },
    { desc: 'namespaces', filters: { namespaces: ['team-a'] } },
    { desc: 'nodes', filters: { nodes: ['node-1'] } },
  ])('is true with only $desc set', ({ filters }) => {
    expect(hasKubernetesFilters(filters)).toBe(true);
  });

  it('is false for the default scope, including empty lists', () => {
    expect(hasKubernetesFilters({})).toBe(false);
    expect(hasKubernetesFilters({ namespaces: [], nodes: [] })).toBe(false);
  });
});

describe('kubernetes filters storage', () => {
  it('persists the normalized filters under the kubernetes key', async () => {
    await saveKubernetesFilters({
      cluster: ' prod ',
      namespaces: ['team-a', 'team-a', ' team-b ', ''],
      nodes: [' node-1 ', 'node-1'],
    });

    expect(mockSetItem).toHaveBeenCalledWith(
      'kubernetes-filters',
      JSON.stringify({ cluster: 'prod', namespaces: ['team-a', 'team-b'], nodes: ['node-1'] })
    );
  });

  it('reads storage once, normalizing the stored value, and serves later reads from memory', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ cluster: ' prod ', namespaces: ['a', 'a'], junk: true }));

    await expect(getKubernetesFilters()).resolves.toStrictEqual({ cluster: 'prod', namespaces: ['a'] });
    await expect(getKubernetesFilters()).resolves.toStrictEqual({ cluster: 'prod', namespaces: ['a'] });

    expect(mockGetItem).toHaveBeenCalledTimes(1);
    expect(mockGetItem).toHaveBeenCalledWith('kubernetes-filters');
  });

  it.each([
    { desc: 'corrupt JSON', arrange: () => mockGetItem.mockResolvedValue('{bad') },
    { desc: 'an unreadable store', arrange: () => mockGetItem.mockRejectedValue(new Error('offline')) },
  ])('reads $desc as no filters', async ({ arrange }) => {
    arrange();

    await expect(getKubernetesFilters()).resolves.toStrictEqual({});
  });

  it('serves the saved value to readers, bumps the version, and notifies subscribers until they unsubscribe', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeKubernetesFilters(listener);
    expect(getKubernetesFiltersVersion()).toBe(0);

    await saveKubernetesFilters({ cluster: 'prod' });

    expect(getKubernetesFiltersVersion()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
    await expect(getKubernetesFilters()).resolves.toStrictEqual({ cluster: 'prod' });
    // The save replaced the cached value; no read-back from storage.
    expect(mockGetItem).not.toHaveBeenCalled();

    unsubscribe();
    await saveKubernetesFilters({ cluster: 'staging' });

    expect(getKubernetesFiltersVersion()).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps the previous filters, version, and silence when persisting fails', async () => {
    await saveKubernetesFilters({ cluster: 'prod' });
    const listener = jest.fn();
    subscribeKubernetesFilters(listener);
    mockSetItem.mockRejectedValueOnce(new Error('quota exceeded'));

    await expect(saveKubernetesFilters({ cluster: 'other' })).rejects.toThrow('quota exceeded');

    expect(getKubernetesFiltersVersion()).toBe(1);
    expect(listener).not.toHaveBeenCalled();
    await expect(getKubernetesFilters()).resolves.toStrictEqual({ cluster: 'prod' });
  });
});
