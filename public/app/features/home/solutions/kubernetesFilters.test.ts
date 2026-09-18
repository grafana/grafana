import { act, renderHook } from '@testing-library/react';

import {
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
    { desc: 'non-object input', input: 'cluster', expected: {} },
    { desc: 'a trimmed cluster', input: { cluster: '  prod  ' }, expected: { cluster: 'prod' } },
    { desc: 'a blank cluster', input: { cluster: '   ' }, expected: {} },
    { desc: 'a non-string cluster', input: { cluster: 7 }, expected: {} },
    {
      desc: 'lists trimmed, deduped in first-seen order, non-strings and blanks dropped',
      input: { namespaces: [' b ', 'a', 'b', 3, '', '  ', 'a'], nodes: [' node-1 ', 'node-1'] },
      expected: { namespaces: ['b', 'a'], nodes: ['node-1'] },
    },
    { desc: 'lists with nothing surviving', input: { namespaces: ['', 4, null], nodes: 'default' }, expected: {} },
  ])('normalizes $desc', ({ input, expected }) => {
    expect(normalizeKubernetesFilterValues(input)).toStrictEqual(expected);
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
    { desc: 'no usable datasource uid', input: { datasourceUid: '  ', values: { cluster: 'prod' } } },
    { desc: 'no values', input: { datasourceUid: uid } },
    { desc: 'values that all normalize away', input: { datasourceUid: uid, values: { namespaces: [''] } } },
    // Values at the top level are the values shape, not a selection: never silently adopted.
    { desc: 'values outside the values key', input: { datasourceUid: uid, cluster: 'prod' } },
  ])('is null for $desc', ({ input }) => {
    expect(normalizeKubernetesFilterSelection(input)).toBeNull();
  });
});

describe('kubernetesFilterValuesFor', () => {
  it('returns the saved values only for the datasource they were picked from', () => {
    const selection = { datasourceUid: uid, values: { cluster: 'prod' } };

    expect(kubernetesFilterValuesFor(selection, uid)).toBe(selection.values);
    expect(kubernetesFilterValuesFor(selection, 'other-uid')).toStrictEqual({});
    expect(kubernetesFilterValuesFor(null, uid)).toStrictEqual({});
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
    { desc: 'nothing stored', raw: null },
    { desc: 'corrupt JSON', raw: '{bad' },
    { desc: 'a selection without values', raw: JSON.stringify({ datasourceUid: uid }) },
  ])('reads $desc as no selection', ({ raw }) => {
    if (raw !== null) {
      window.localStorage.setItem(KUBERNETES_FILTERS_STORAGE_KEY, raw);
    }

    const { result } = renderHook(() => useKubernetesFilterSelection());

    expect(result.current[0]).toBeNull();
  });

  it('persists the normalized selection to every subscriber, and null clears it', () => {
    const writer = renderHook(() => useKubernetesFilterSelection());
    const reader = renderHook(() => useKubernetesFilterSelection());

    act(() => {
      writer.result.current[1]({ datasourceUid: uid, values: { cluster: ' prod ', namespaces: ['team-a', 'team-a'] } });
    });

    const expected = { datasourceUid: uid, values: { cluster: 'prod', namespaces: ['team-a'] } };
    expect(reader.result.current[0]).toStrictEqual(expected);
    expect(window.localStorage.getItem(KUBERNETES_FILTERS_STORAGE_KEY)).toBe(JSON.stringify(expected));

    act(() => {
      writer.result.current[1](null);
    });

    expect(reader.result.current[0]).toBeNull();
    expect(window.localStorage.getItem(KUBERNETES_FILTERS_STORAGE_KEY)).toBe('');
  });
});
