import { act, renderHook } from '@testing-library/react';

import { toDataFrame } from '@grafana/data';
import { FilterByValueMatch, FilterByValueType } from '@grafana/data/internal';

import { clearFrameFilters } from './filterByValue';
import { columnTransformations, filterTransformations } from './registry';
import { useTableTransformations } from './useTableTransformations';

it('composes local column and nested filter actions, and clears only the selected frame filters', () => {
  const source = toDataFrame({ refId: 'A', fields: [{ name: 'value', values: [1, 2] }] });
  const field = source.fields[0];
  const context = { source, field, frameKey: 'A', frameIndex: 0 };
  const columns = { catalog: ['value'] };
  const predicate = filterTransformations.valueFilter.createPredicate(field, ['1']);
  const { result } = renderHook(() => useTableTransformations(undefined, 'table', true));

  act(() => {
    result.current.update((current) => columnTransformations.columnOrder.write(current, ['value'], columns));
    result.current.update((current) => filterTransformations.valueFilter.write(current, predicate, context));
    result.current.update((current) =>
      filterTransformations.valueFilter.write(current, predicate, { ...context, parentIndex: 0 })
    );
    result.current.update((current) =>
      filterTransformations.valueFilter.write(current, predicate, { ...context, frameKey: 'B', frameIndex: 1 })
    );
  });

  expect(
    result.current.transformations.map((config) => [
      config.id,
      config.options.target?.frameKey,
      config.options.target?.parentIndex,
    ])
  ).toEqual([
    ['filterByValue', 'A', 0],
    ['filterByValue', 'A', undefined],
    ['filterByValue', 'B', undefined],
    ['organize', undefined, undefined],
  ]);
  act(() => result.current.update((current) => clearFrameFilters(current, 'A')));
  expect(result.current.transformations).toEqual([
    {
      id: 'filterByValue',
      options: {
        type: FilterByValueType.include,
        match: FilterByValueMatch.all,
        missingField: 'ignore',
        target: { frameKey: 'B', frameIndex: 1, refId: 'A', parentIndex: undefined, parentKey: undefined },
        filters: [{ fieldName: 'value', field: { name: 'value', labels: undefined }, config: predicate }],
      },
    },
    { id: 'organize', options: { indexByName: { value: 0 }, excludeByName: {}, renameByName: {} } },
  ]);
});

it('preserves the saved display configuration when editing selected values', () => {
  const field = toDataFrame({ fields: [{ name: 'value', values: [1], config: { unit: 'bytes', decimals: 2 } }] })
    .fields[0];
  const initial = filterTransformations.valueFilter.createPredicate(field, ['1']);
  expect(initial.options.displayConfig).toEqual({ unit: 'bytes', decimals: 2 });
  const edited = filterTransformations.valueFilter.createPredicate(field, ['2'], {
    values: ['1'],
    mode: 'display',
    displayConfig: { unit: 'short', decimals: 0 },
    timeZone: 'UTC',
  });
  expect(edited).toEqual({
    id: 'inSet',
    options: {
      values: ['2'],
      mode: 'display',
      displayConfig: { unit: 'short', decimals: 0 },
      timeZone: 'UTC',
    },
  });
});
