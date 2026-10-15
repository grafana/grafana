import { type DataTransformerConfig, DataTransformerID, FieldType, toDataFrame } from '@grafana/data';

import { readTableSort, writeTableSort } from './sortBy';

const source = toDataFrame({
  refId: 'A',
  fields: [
    { name: 'value', type: FieldType.number, values: [2, 1], labels: { host: 'one' } },
    { name: 'other', type: FieldType.string, values: ['b', 'a'] },
  ],
});
source.fields[0].state = { displayName: 'Value' };
const context = { source, frameKey: 'A/0', frameIndex: 0, initialSort: [{ displayName: 'other', desc: true }] };

it('reads the initial sort until a table sort is written', () => {
  expect(readTableSort([], context)).toEqual([{ columnKey: 'other', direction: 'DESC' }]);
  const next = writeTableSort([], [{ columnKey: 'Value', direction: 'ASC' }], context);
  expect(readTableSort(next, context)).toEqual([{ columnKey: 'Value', direction: 'ASC' }]);
  expect(next[0]).toEqual({
    id: DataTransformerID.sortBy,
    options: {
      table: true,
      target: { frameKey: 'A/0', frameIndex: 0, refId: 'A' },
      sort: [{ field: 'value', displayName: 'Value', fieldLabels: { host: 'one' }, desc: false }],
    },
  });
});

it('places sorting after filters and before column organization', () => {
  const current: DataTransformerConfig[] = [
    { id: DataTransformerID.filterByValue, options: { filters: [] } },
    { id: DataTransformerID.organize, options: {} },
  ];
  const next = writeTableSort(current, [{ columnKey: 'Value', direction: 'ASC' }], context);
  expect(next.map((config) => config.id)).toEqual([
    DataTransformerID.filterByValue,
    DataTransformerID.sortBy,
    DataTransformerID.organize,
  ]);
});

it('retains an empty sort to override the panel default', () => {
  const next = writeTableSort([], [], context);
  expect(readTableSort(next, context)).toEqual([]);
});
