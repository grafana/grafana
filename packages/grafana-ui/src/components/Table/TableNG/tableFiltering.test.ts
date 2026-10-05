import { DataTransformerID, FieldType, toDataFrame } from '@grafana/data';
import { FilterByValueMatch, FilterByValueType, type FilterByValueConfig } from '@grafana/data/internal';

import { tableViewIndices, transformTableFrame } from './tableFiltering';

function frame() {
  return toDataFrame({
    fields: [
      { name: 'Value', type: FieldType.number, values: [10, 2, 3, -1, null] },
      { name: 'Time', type: FieldType.time, values: [1000, 1000, 1000, 2000, 3000], nanos: [3, 1, 2, 0, 0] },
    ],
  });
}

function range(min?: number, max?: number, parentIndex?: number): FilterByValueConfig {
  return {
    id: DataTransformerID.filterByValue,
    options: {
      type: FilterByValueType.include,
      match: FilterByValueMatch.all,
      missingField: 'ignore',
      filters: [{ fieldName: 'Value', config: { id: 'numericRange', options: { min, max, includeMissing: false } } }],
      target: { frameKey: 'already-selected-frame', parentIndex },
    },
  };
}

it('projects original indices through sequential filters and keeps nanoseconds aligned', () => {
  const source = frame();
  const filters = [range(2), range(undefined, 3)];
  expect(tableViewIndices(source, filters)).toEqual([1, 2]);
  const output = transformTableFrame(source, filters);
  expect(output.fields[0].values).toEqual([2, 3]);
  expect(output.fields[1].nanos).toEqual([1, 2]);
  expect(source.fields[0].values).toEqual([10, 2, 3, -1, null]);
  expect(source.fields[1].nanos).toEqual([3, 1, 2, 0, 0]);
  expect(source.fields.map((field) => field.name)).toEqual(['Value', 'Time']);
});

it('skips disabled filters and selects only filters for the requested parent', () => {
  const disabled = { ...range(100), disabled: true };
  const filters = [range(10), range(2, 3, 0), range(-1, -1, 1), disabled];
  expect(tableViewIndices(frame(), filters)).toEqual([0]);
  expect(tableViewIndices(frame(), filters, 0)).toEqual([1, 2]);
  expect(tableViewIndices(frame(), filters, 1)).toEqual([3]);
});

it('avoids existing index-column names when projecting rows', () => {
  const source = frame();
  source.fields.push(
    { name: '__table_view_index', type: FieldType.number, config: {}, values: [0, 0, 1, 0, 0] },
    { name: '__table_view_index_', type: FieldType.number, config: {}, values: [9, 9, 9, 9, 9] }
  );
  const filter = range(1, 1);
  filter.options.filters[0].fieldName = '__table_view_index';
  expect(tableViewIndices(source, [filter])).toEqual([2]);
  expect(source.fields[2].values).toEqual([0, 0, 1, 0, 0]);
  expect(source.fields.map((field) => field.name)).toEqual([
    'Value',
    'Time',
    '__table_view_index',
    '__table_view_index_',
  ]);
});

it('returns every source index without filters and none when no rows match', () => {
  expect(tableViewIndices(frame(), [])).toEqual([0, 1, 2, 3, 4]);
  expect(tableViewIndices(frame(), [range(100)])).toEqual([]);
});
