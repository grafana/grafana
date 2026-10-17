import { cacheFieldDisplayNames, type DataFrame, type Field } from '@grafana/data';
import { type FilterByValueConfig } from '@grafana/data/internal';

import { type TableRow } from '../types';
import { type ApplyFilterResult } from '../utils';

import { tableFilterKey, matchesTableFilter } from './filterByValue';
import { tableViewIndices } from './tableFiltering';

export class TableFilterEvaluationError extends Error {
  constructor(readonly originalError: Error) {
    super(originalError.message);
    this.name = 'TableFilterEvaluationError';
  }
}

function asFilterError(error: unknown): TableFilterEvaluationError {
  return new TableFilterEvaluationError(error instanceof Error ? error : new Error(String(error)));
}

function createRowProjector(rows: TableRow[], fields: Field[], parentIndex?: number) {
  const parents = rows.filter((row) => row.__depth === 0);
  const frame: DataFrame = {
    length: parents.length,
    fields: fields.map((field) => ({
      ...field,
      state: field.state ? { ...field.state } : undefined,
      values: parents.map((row) => field.values[row.__index]),
      ...(field.nanos ? { nanos: parents.map((row) => field.nanos![row.__index]) } : {}),
    })),
  };
  cacheFieldDisplayNames([frame]);
  const children = new Map(rows.filter((row) => row.__depth !== 0).map((row) => [row.__index, row]));
  return (filters: readonly FilterByValueConfig[]): TableRow[] => {
    const indices = tableViewIndices(frame, filters, parentIndex);
    return indices.flatMap((index) => {
      const row = parents[index];
      const child = children.get(row.__index);
      return child ? [row, child] : [row];
    });
  };
}

export function transformTableFilters(
  rows: TableRow[],
  fields: Field[],
  filters: readonly FilterByValueConfig[],
  parentIndex?: number
): ApplyFilterResult {
  try {
    return projectTableFilters(rows, fields, filters, parentIndex);
  } catch (error) {
    throw asFilterError(error);
  }
}

function projectTableFilters(
  rows: TableRow[],
  fields: Field[],
  filters: readonly FilterByValueConfig[],
  parentIndex?: number
): ApplyFilterResult {
  const scoped = filters.filter((config) => !config.disabled && config.options.target?.parentIndex === parentIndex);
  if (!scoped.length) {
    return { filteredRows: rows, crossFilterOrder: [], crossFilterRows: {}, crossFilterTailRows: rows };
  }
  let projector: ReturnType<typeof createRowProjector> | undefined;
  const projectRows = (selected: readonly FilterByValueConfig[]) => {
    if (!selected.length) {
      return rows;
    }
    projector ??= createRowProjector(rows, fields, parentIndex);
    return projector(selected);
  };
  const crossFilterRows: Record<string, () => TableRow[]> = {};
  const crossFilterOrder: string[] = [];
  for (const field of fields) {
    const selected = scoped.filter((config) => matchesTableFilter(config, field, parentIndex));
    if (selected.length) {
      const key = tableFilterKey(field, parentIndex);
      const otherFilters = scoped.filter((config) => !selected.includes(config));
      let cached: TableRow[] | undefined;
      crossFilterRows[key] = () => {
        try {
          return (cached ??= projectRows(otherFilters));
        } catch (error) {
          throw asFilterError(error);
        }
      };
      crossFilterOrder.push(key);
    }
  }
  const filteredRows = projectRows(scoped);
  return { filteredRows, crossFilterOrder, crossFilterRows, crossFilterTailRows: filteredRows };
}
