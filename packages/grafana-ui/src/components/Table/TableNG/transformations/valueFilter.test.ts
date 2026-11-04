import { act, renderHook } from '@testing-library/react';

import { createTheme, FieldType, formattedValueToString, getDisplayProcessor, toDataFrame } from '@grafana/data';
import { FilterByValueMatch, FilterByValueType, type FilterByValueConfig } from '@grafana/data/internal';

import { clearFrameFilters, writeTableFilter } from './filterByValue';
import { columnTransformations } from './registry';
import { tableViewIndices } from './tableFiltering';
import { useTableTransformations } from './useTableTransformations';
import { createValuePredicate } from './valueFilter';

it('composes local column and nested filter actions, and clears only the selected frame filters', () => {
  const source = toDataFrame({ refId: 'A', fields: [{ name: 'value', values: [1, 2] }] });
  const field = source.fields[0];
  const context = { source, field, frameKey: 'A', frameIndex: 0 };
  const columns = { catalog: ['value'] };
  const predicate = createValuePredicate(field, ['1']);
  const { result } = renderHook(() => useTableTransformations(undefined, 'table', true));

  act(() => {
    result.current.update((current) => columnTransformations.columnOrder.write(current, ['value'], columns));
    result.current.update((current) => writeTableFilter(current, predicate, context));
    result.current.update((current) => writeTableFilter(current, predicate, { ...context, parentIndex: 0 }));
    result.current.update((current) =>
      writeTableFilter(current, predicate, { ...context, frameKey: 'B', frameIndex: 1 })
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

it('uses the current display configuration when editing selected values', () => {
  const field = toDataFrame({ fields: [{ name: 'value', values: [1], config: { unit: 'bytes', decimals: 2 } }] })
    .fields[0];
  const initial = createValuePredicate(field, ['1']);
  expect(initial.options.displayConfig).toBe(field.config);
  const edited = createValuePredicate(
    field,
    ['2'],
    {
      values: ['1'],
      mode: 'display',
      displayConfig: { unit: 'short', decimals: 0 },
      timeZone: 'UTC',
    },
    'Pacific/Auckland'
  );
  expect(edited).toEqual({
    id: 'inSet',
    options: {
      values: ['2'],
      mode: 'display',
      displayConfig: field.config,
      timeZone: 'Pacific/Auckland',
    },
  });
});

it('matches displayed time values in the panel timezone', () => {
  const timeZone = 'Pacific/Auckland';
  const source = toDataFrame({
    fields: [{ name: 'Time', type: FieldType.time, values: [1767225600000, 1767312000000] }],
  });
  const field = source.fields[0];
  field.display = getDisplayProcessor({ field, theme: createTheme(), timeZone });
  const value = formattedValueToString(field.display(field.values[0]));
  const predicate = createValuePredicate(field, [value], undefined, timeZone);
  const config = writeTableFilter([], predicate, {
    source,
    field,
    frameKey: 'time-frame',
    frameIndex: 0,
  });

  expect(predicate.options.timeZone).toBe(timeZone);
  expect(tableViewIndices(source, config as FilterByValueConfig[])).toEqual([0]);
});
