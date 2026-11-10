import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';

import { createDataFrame, FieldType, type DataTransformerConfig } from '@grafana/data';

import { createRangePredicate } from './rangeFilter';
import { useRowTransformations } from './useRowTransformations';

it.each([
  [FieldType.number, 'numeric_range'],
  [FieldType.time, 'date_range'],
])('reports applied %s ranges without field names or bounds, and ignores removal', (type, kind) => {
  const data = createDataFrame({ fields: [{ name: 'Private field', type, values: [1, 2, 3] }] });
  const onFilterInteraction = jest.fn();
  const { result, rerender } = renderHook(
    () => useRowTransformations({ data, width: 300, height: 200, onFilterInteraction }),
    { wrapper: StrictMode }
  );
  const predicate = createRangePredicate({ min: 1, max: 2, includeMissing: false });
  expect(result.current.value.filters).toEqual([]);
  expect(onFilterInteraction).not.toHaveBeenCalled();
  act(() => result.current.value.applyFilter(data.fields[0], predicate));
  expect(onFilterInteraction.mock.calls).toEqual([[{ filter_type: 'local', filter_kind: kind }]]);
  act(() => result.current.value.applyFilter(data.fields[0], predicate));
  rerender();
  expect(onFilterInteraction).toHaveBeenCalledTimes(1);
  act(() => result.current.value.clearFilter(data.fields[0]));
  act(() => result.current.value.clearFilter(data.fields[0]));
  expect(result.current.value.filters).toEqual([]);
  expect(onFilterInteraction).toHaveBeenCalledTimes(1);
});

it('reports transformation-backed changes after persistence and suppresses unchanged filters', () => {
  const data = createDataFrame({ fields: [{ name: 'Private field', type: FieldType.number, values: [1, 2, 3] }] });
  let configs: readonly DataTransformerConfig[] = [];
  const onFilterInteraction = jest.fn(() => expect(configs).toHaveLength(1));
  const api = {
    get: () => configs,
    set: (_owner: string, next: typeof configs) => {
      configs = next;
    },
    getSourceSeries: () => [data],
    subscribe: () => () => {},
  };
  const { result } = renderHook(() =>
    useRowTransformations({
      data,
      width: 300,
      height: 200,
      onFilterInteraction,
      rowTransformations: { api, owner: 'table', frameKey: 'frame' },
    })
  );
  const predicate = createRangePredicate({ min: 1, max: 2, includeMissing: false });
  act(() => result.current.value.applyFilter(data.fields[0], predicate));
  act(() => result.current.value.applyFilter(data.fields[0], predicate));
  expect(onFilterInteraction.mock.calls).toEqual([[{ filter_type: 'transformation', filter_kind: 'numeric_range' }]]);
});
