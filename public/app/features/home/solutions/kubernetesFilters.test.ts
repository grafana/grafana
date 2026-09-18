import { act, renderHook } from '@testing-library/react';

import {
  hasKubernetesFilters,
  KUBERNETES_FILTERS_STORAGE_KEY,
  normalizeKubernetesFilters,
  useKubernetesFilters,
} from './kubernetesFilters';

beforeEach(() => {
  window.localStorage.clear();
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

describe('useKubernetesFilters', () => {
  it('reads the persisted filters normalized, with one identity until the stored value changes', () => {
    window.localStorage.setItem(
      KUBERNETES_FILTERS_STORAGE_KEY,
      JSON.stringify({ cluster: ' prod ', namespaces: ['a', 'a'], junk: true })
    );

    const { result, rerender } = renderHook(() => useKubernetesFilters());
    const [first] = result.current;
    rerender();

    expect(first).toStrictEqual({ cluster: 'prod', namespaces: ['a'] });
    expect(result.current[0]).toBe(first);
  });

  it.each([
    { desc: 'nothing stored', arrange: () => {} },
    { desc: 'corrupt JSON', arrange: () => window.localStorage.setItem(KUBERNETES_FILTERS_STORAGE_KEY, '{bad') },
  ])('reads $desc as no filters', ({ arrange }) => {
    arrange();

    const { result } = renderHook(() => useKubernetesFilters());

    expect(result.current[0]).toStrictEqual({});
  });

  it('persists the normalized filters and updates every subscriber', () => {
    const writer = renderHook(() => useKubernetesFilters());
    const reader = renderHook(() => useKubernetesFilters());

    act(() => {
      writer.result.current[1]({
        cluster: ' prod ',
        namespaces: ['team-a', 'team-a', ' team-b ', ''],
        nodes: [' node-1 ', 'node-1'],
      });
    });

    const expected = { cluster: 'prod', namespaces: ['team-a', 'team-b'], nodes: ['node-1'] };
    expect(reader.result.current[0]).toStrictEqual(expected);
    expect(window.localStorage.getItem(KUBERNETES_FILTERS_STORAGE_KEY)).toBe(JSON.stringify(expected));
  });
});
