import { cacheFieldDisplayNames, createDataFrame, DataTransformerID, FieldType } from '@grafana/data';
import { FilterByValueMatch, FilterByValueType, type FilterByValueConfig } from '@grafana/data/internal';

import { compileFrameToRecords } from '../utils';

import { transformTableFilters } from './rowProjection';

function valueFilter(fieldName: string, values: string[], parentIndex?: number): FilterByValueConfig {
  return {
    id: DataTransformerID.filterByValue,
    options: {
      type: FilterByValueType.include,
      match: FilterByValueMatch.all,
      missingField: 'ignore',
      target: { frameKey: 'test', parentIndex },
      filters: [
        {
          fieldName,
          field: { name: fieldName },
          config: { id: 'inSet', options: { mode: 'display', values } },
        },
      ],
    },
  };
}

const frame = createDataFrame({
  fields: [
    { name: 'category', type: FieldType.string, values: ['A', 'A', 'B', 'B', 'C'] },
    { name: 'status', type: FieldType.string, values: ['up', 'down', 'up', 'down', 'up'] },
  ],
});
const rows = compileFrameToRecords(frame.fields.map((field) => field.name))(frame);

it('cross-filters from all other active fields and preserves original row indices', () => {
  const result = transformTableFilters(rows, frame.fields, [
    valueFilter('category', ['A', 'B']),
    valueFilter('status', ['up']),
  ]);

  expect(result.filteredRows.map((row) => row.__index)).toEqual([0, 2]);
  const crossFilterIndices = Object.values(result.crossFilterRows).map((getRows) =>
    getRows().map((row) => row.__index)
  );
  expect(crossFilterIndices).toHaveLength(2);
  expect(crossFilterIndices).toEqual(
    expect.arrayContaining([
      [0, 2, 4],
      [0, 1, 2, 3],
    ])
  );
});

it('applies nested filters only to their parent row', () => {
  const filters = [valueFilter('category', ['A'], 7)];

  expect(transformTableFilters(rows, frame.fields, filters, 7).filteredRows.map((row) => row.__index)).toEqual([0, 1]);
  expect(transformTableFilters(rows, frame.fields, filters, 8).filteredRows.map((row) => row.__index)).toEqual([
    0, 1, 2, 3, 4,
  ]);
});

it('does not rewrite cached display names on source fields while projecting rows', () => {
  const first = createDataFrame({
    name: 'first',
    fields: [{ name: 'Value', type: FieldType.number, values: [1, 2] }],
  });
  const second = createDataFrame({
    name: 'second',
    fields: [{ name: 'Value', type: FieldType.number, values: [3] }],
  });
  cacheFieldDisplayNames([first, second]);
  const state = first.fields[0].state;
  const displayName = state?.displayName;
  const sourceRows = compileFrameToRecords(first.fields.map((field) => field.state!.displayName!))(first);

  expect(transformTableFilters(sourceRows, first.fields, [valueFilter('Value', ['1'])]).filteredRows).toHaveLength(1);
  expect(first.fields[0].state).toBe(state);
  expect(first.fields[0].state?.displayName).toBe(displayName);
  expect(first.fields[0].state?.multipleFrames).toBe(true);
});
