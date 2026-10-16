import { createDataFrame, DataTransformerID, FieldType } from '@grafana/data';
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
  expect(result.crossFilterOrder).toEqual(['["category",[],null]', '["status",[],null]']);
  expect(result.crossFilterRows['["category",[],null]'].map((row) => row.__index)).toEqual([0, 2, 4]);
  expect(result.crossFilterRows['["status",[],null]'].map((row) => row.__index)).toEqual([0, 1, 2, 3]);
});

it('applies nested filters only to their parent row', () => {
  const filters = [valueFilter('category', ['A'], 7)];

  expect(transformTableFilters(rows, frame.fields, filters, 7).filteredRows.map((row) => row.__index)).toEqual([0, 1]);
  expect(transformTableFilters(rows, frame.fields, filters, 8).filteredRows.map((row) => row.__index)).toEqual([
    0, 1, 2, 3, 4,
  ]);
});
