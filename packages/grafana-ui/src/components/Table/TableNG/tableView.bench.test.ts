import {
  cacheFieldDisplayNames,
  DataTransformerID,
  FieldType,
  getDisplayProcessor,
  createTheme,
  toDataFrame,
} from '@grafana/data';
import { FilterByValueType, FilterByValueMatch, type FilterByValueConfig } from '@grafana/data/internal';
import { type SortColumn } from '@grafana/react-data-grid';

import { transformTableFilters, transformTableRows } from './TableViewContext';
import { type FilterType } from './types';
import { applyFilter, applySort, compileFrameToRecords, getColumnTypes } from './utils';

const benchmark = process.env.TABLE_VIEW_BENCH === '1' ? it : it.skip;
benchmark.each([10_000, 100_000])('compares legacy and transformation view execution on %i rows', (length) => {
  const frame = toDataFrame({
    fields: [
      { name: 'name', type: FieldType.string, values: Array.from({ length }, (_, i) => `group${i % 100}`) },
      ...Array.from({ length: 5 }, (_, col) => ({
        name: `value${col}`,
        type: FieldType.number,
        values: Array.from({ length }, (_, i) => (i * 31 + col) % 1000),
      })),
    ],
  });
  const theme = createTheme();
  for (const field of frame.fields) {
    field.display = getDisplayProcessor({ field, theme });
  }
  cacheFieldDisplayNames([frame]);
  const rows = compileFrameToRecords(frame.fields.map((field) => field.name))(frame);
  const filters: FilterType = {
    name: { displayName: 'name', filteredSet: new Set(Array.from({ length: 50 }, (_, i) => `group${i}`)) },
  };
  const configs: FilterByValueConfig[] = [
    {
      id: DataTransformerID.filterByValue,
      options: {
        type: FilterByValueType.include,
        match: FilterByValueMatch.all,
        filters: [
          {
            fieldName: 'name',
            config: { id: 'inSet', options: { values: Array.from(filters.name.filteredSet), mode: 'display' } },
          },
        ],
      },
    },
  ];
  const sort: SortColumn[] = [
    { columnKey: 'value0', direction: 'DESC' },
    { columnKey: 'name', direction: 'ASC' },
  ];
  const legacy = () =>
    applySort(applyFilter(rows, filters, frame.fields).filteredRows, frame.fields, sort, getColumnTypes(frame.fields));
  const transforms = () =>
    transformTableRows(transformTableFilters(rows, frame.fields, configs).filteredRows, frame.fields, [], sort);
  expect(transforms().map((row) => row.__index)).toEqual(legacy().map((row) => row.__index));
  function median(run: () => unknown) {
    run();
    const times = Array.from({ length: 7 }, () => {
      const start = performance.now();
      run();
      return performance.now() - start;
    });
    return Number(times.sort((a, b) => a - b)[3].toFixed(1));
  }
  process.stdout.write(
    JSON.stringify({ rows: length, fields: 6, legacyMs: median(legacy), transformationsMs: median(transforms) }) + '\n'
  );
});
