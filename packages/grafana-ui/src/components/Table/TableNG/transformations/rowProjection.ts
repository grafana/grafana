import { cacheFieldDisplayNames, type DataFrame, type Field } from '@grafana/data';
import { type FilterByValueConfig } from '@grafana/data/internal';

import { type TableRow } from '../types';
import { type ApplyFilterResult } from '../utils';

import { tableFilterKey, matchesTableFilter } from './filterByValue';
import { tableViewIndices } from './tableFiltering';

export function transformTableRows(
  rows: TableRow[],
  fields: Field[],
  filters: readonly FilterByValueConfig[],
  parentIndex?: number
): TableRow[] {
  if (!filters.length) {
    return rows;
  }
  const parents = rows.filter((row) => row.__depth === 0);
  const frame: DataFrame = {
    length: parents.length,
    fields: fields.map((field) => ({
      ...field,
      values: parents.map((row) => field.values[row.__index]),
      ...(field.nanos ? { nanos: parents.map((row) => field.nanos![row.__index]) } : {}),
    })),
  };
  cacheFieldDisplayNames([frame]);
  const indices = tableViewIndices(frame, filters, parentIndex);
  const children = new Map(rows.filter((row) => row.__depth !== 0).map((row) => [row.__index, row]));
  return indices.flatMap((index) => {
    const row = parents[index];
    const child = children.get(row.__index);
    return child ? [row, child] : [row];
  });
}

export function transformTableFilters(
  rows: TableRow[],
  fields: Field[],
  filters: readonly FilterByValueConfig[],
  parentIndex?: number
): ApplyFilterResult {
  const scoped = filters.filter((config) => config.options.target?.parentIndex === parentIndex);
  const entries = fields.flatMap((field) => {
    const selected = scoped.filter((config) => matchesTableFilter(config, field, parentIndex));
    return selected.length
      ? [
          [
            tableFilterKey(field, parentIndex),
            transformTableRows(
              rows,
              fields,
              filters.filter((config) => !selected.includes(config)),
              parentIndex
            ),
          ] as const,
        ]
      : [];
  });
  const crossFilterOrder = entries.map(([key]) => key);
  const crossFilterRows = Object.fromEntries(entries);
  const filteredRows = transformTableRows(rows, fields, filters, parentIndex);
  return { filteredRows, crossFilterOrder, crossFilterRows, crossFilterTailRows: filteredRows };
}
