import { act, renderHook } from '@testing-library/react';

import {
  hasKubernetesFilters,
  KUBERNETES_FILTERS_STORAGE_KEY,
  kubernetesFilterValuesFor,
  normalizeKubernetesFilterSelection,
  normalizeKubernetesFilterValues,
  useKubernetesFilterSelection,
} from './kubernetesFilters';

const uid = 'prom-uid';

beforeEach(() => {
  window.localStorage.clear();
});

describe('normalizeKubernetesFilterValues', () => {
  it.each([
    { desc: 'null', input: null },
    { desc: 'a string', input: 'cluster' },
    { desc: 'a number', input: 42 },
    { desc: 'undefined', input: undefined },
  ])('returns no values for $desc', ({ input }) => {
    expect(normalizeKubernetesFilterValues(input)).toStrictEqual({});
  });

  it('trims the cluster and drops it when blank', () => {
    expect(normalizeKubernetesFilterValues({ cluster: '  prod  ' })).toStrictEqual({ cluster: 'prod' });
    expect(normalizeKubernetesFilterValues({ cluster: '   ' })).toStrictEqual({});
    expect(normalizeKubernetesFilterValues({ cluster: 7 })).toStrictEqual({});
  });

  it.each(['namespaces', 'nodes'] as const)(
    'trims, dedupes, and drops non-string %s preserving first-seen order',
    (key) => {
      expect(normalizeKubernetesFilterValues({ [key]: [' b ', 'a', 'b', 3, '', '  ', 'a'] })).toStrictEqual({
        [key]: ['b', 'a'],
      });
    }
  );

  it.each(['namespaces', 'nodes'] as const)('omits the %s key entirely when nothing survives', (key) => {
    expect(normalizeKubernetesFilterValues({ [key]: ['', 4, null] })).toStrictEqual({});
    expect(normalizeKubernetesFilterValues({ [key]: 'default' })).toStrictEqual({});
  });
});

describe('normalizeKubernetesFilterSelection', () => {
  it('binds normalized values to a trimmed datasource uid', () => {
    expect(
      normalizeKubernetesFilterSelection({ datasourceUid: ` ${uid} `, values: { cluster: ' prod ', junk: true } })
    ).toStrictEqual({ datasourceUid: uid, values: { cluster: 'prod' } });
  });

  it.each([
    { desc: 'not an object', input: 'prod' },
    { desc: 'no datasource uid', input: { values: { cluster: 'prod' } } },
    { desc: 'a blank datasource uid', input: { datasourceUid: '  ', values: { cluster: 'prod' } } },
    { desc: 'a non-string datasource uid', input: { datasourceUid: 7, values: { cluster: 'prod' } } },
    { desc: 'no values', input: { datasourceUid: uid } },
    { desc: 'values that all normalize away', input: { datasourceUid: uid, values: { namespaces: [''] } } },
    // Values at the top level are the values shape, not a selection: never silently adopted.
    { desc: 'values outside the values key', input: { datasourceUid: uid, cluster: 'prod' } },
  ])('is null for $desc', ({ input }) => {
    expect(normalizeKubernetesFilterSelection(input)).toBeNull();
  });
});

describe('kubernetesFilterValuesFor', () => {
  const selection = { datasourceUid: uid, values: { cluster: 'prod' } };

  it('returns the saved values for the datasource they were picked from', () => {
    expect(kubernetesFilterValuesFor(selection, uid)).toBe(selection.values);
  });

  it('returns no values for any other datasource or without a selection', () => {
    expect(kubernetesFilterValuesFor(selection, 'other-uid')).toStrictEqual({});
    expect(kubernetesFilterValuesFor(null, uid)).toStrictEqual({});
  });
});

describe('hasKubernetesFilters', () => {
  it.each([
    { desc: 'a cluster', values: { cluster: 'prod' } },
    { desc: 'namespaces', values: { namespaces: ['team-a'] } },
    { desc: 'nodes', values: { nodes: ['node-1'] } },
  ])('is true with only $desc set', ({ values }) => {
    expect(hasKubernetesFilters(values)).toBe(true);
  });

  it('is false for the fleet-wide scope, including empty lists', () => {
    expect(hasKubernetesFilters({})).toBe(false);
    expect(hasKubernetesFilters({ namespaces: [], nodes: [] })).toBe(false);
  });
});

describe('useKubernetesFilterSelection', () => {
  it('reads the persisted selection normalized, with one identity until the stored value changes', () => {
    window.localStorage.setItem(
      KUBERNETES_FILTERS_STORAGE_KEY,
      JSON.stringify({ datasourceUid: uid, values: { cluster: ' prod ', namespaces: ['a', 'a'] }, junk: true })
    );

    const { result, rerender } = renderHook(() => useKubernetesFilterSelection());
    const [first] = result.current;
    rerender();

    expect(first).toStrictEqual({ datasourceUid: uid, values: { cluster: 'prod', namespaces: ['a'] } });
    expect(result.current[0]).toBe(first);
  });

  it.each([
    { desc: 'nothing stored', arrange: () => {} },
    { desc: 'corrupt JSON', arrange: () => window.localStorage.setItem(KUBERNETES_FILTERS_STORAGE_KEY, '{bad') },
    {
      desc: 'a selection without values',
      arrange: () =>
        window.localStorage.setItem(KUBERNETES_FILTERS_STORAGE_KEY, JSON.stringify({ datasourceUid: uid })),
    },
  ])('reads $desc as no selection', ({ arrange }) => {
    arrange();

    const { result } = renderHook(() => useKubernetesFilterSelection());

    expect(result.current[0]).toBeNull();
  });

  it('persists the normalized selection and updates every subscriber', () => {
    const writer = renderHook(() => useKubernetesFilterSelection());
    const reader = renderHook(() => useKubernetesFilterSelection());

    act(() => {
      writer.result.current[1]({
        datasourceUid: uid,
        values: { cluster: ' prod ', namespaces: ['team-a', 'team-a', ' team-b ', ''], nodes: [' node-1 ', 'node-1'] },
      });
    });

    const expected = {
      datasourceUid: uid,
      values: { cluster: 'prod', namespaces: ['team-a', 'team-b'], nodes: ['node-1'] },
    };
    expect(reader.result.current[0]).toStrictEqual(expected);
    expect(window.localStorage.getItem(KUBERNETES_FILTERS_STORAGE_KEY)).toBe(JSON.stringify(expected));
  });

  it.each([
    { desc: 'null', next: null },
    { desc: 'a selection whose values all normalize away', next: { datasourceUid: uid, values: { cluster: ' ' } } },
  ])('clears the stored selection when saving $desc', ({ next }) => {
    window.localStorage.setItem(
      KUBERNETES_FILTERS_STORAGE_KEY,
      JSON.stringify({ datasourceUid: uid, values: { cluster: 'prod' } })
    );
    const { result } = renderHook(() => useKubernetesFilterSelection());
    expect(result.current[0]).not.toBeNull();

    act(() => {
      result.current[1](next);
    });

    expect(result.current[0]).toBeNull();
    expect(window.localStorage.getItem(KUBERNETES_FILTERS_STORAGE_KEY)).toBe('');
  });
});
