// Libraries
import isNumber from 'lodash/isNumber';

import { TableData, NullValueMode } from '../types/index';

/** Reduce each column in a table to a single value */
type TableReducer = (data: TableData, columnIndexes: number[], ignoreNulls: boolean, nullAsZero: boolean) => any[];

/** Information about the reducing(stats) functions */
export interface TableReducerInfo {
  key: string;
  name: string;
  description: string;
  standard: boolean; // The most common stats can all be calculated in a single pass
  reducer?: TableReducer;
  alias?: string; // optional secondary key.  'avg' vs 'mean'
}

/** Get a list of the known reducing functions */
export function getTableReducers(): TableReducerInfo[] {
  return reducers;
}

export interface TableReducerOptions {
  columnIndexes?: number[];
  nullValueMode?: NullValueMode;
  stats: string[]; // The stats to calculate
}

export function reduceTableData(data: TableData, options: TableReducerOptions): TableData[] {
  const indexes = verifyColumns(data, options);
  const columns = indexes.map(v => data.columns[v]);

  const ignoreNulls = options.nullValueMode === NullValueMode.Ignore;
  const nullAsZero = options.nullValueMode === NullValueMode.AsZero;

  // Return early for empty tables
  if (!data.rows || data.rows.length < 1) {
    const val = nullAsZero ? 0 : null;
    const rows = [indexes.map(v => val)];
    return options.stats.map(stat => {
      return {
        columns,
        rows,
        type: 'table',
        columnMap: {},
      };
    });
  }

  if (registry == null) {
    registry = new Map<string, TableReducerInfo>();
    reducers.forEach(calc => {
      registry!.set(calc.key, calc);
      if (calc.alias) {
        registry!.set(calc.alias, calc);
      }
    });
  }

  const queue = options.stats.map(key => {
    const c = registry!.get(key);
    if (!c) {
      throw new Error('Unknown stats calculator: ' + key);
    }
    return c;
  });

  // Avoid the standard calculator if possible
  if (queue.length === 1 && queue[0].reducer) {
    return [
      {
        columns,
        rows: [queue[0].reducer(data, indexes, ignoreNulls, nullAsZero)],
        type: 'table',
        columnMap: {},
      },
    ];
  }

  // For now everything can use the standard stats
  const standard = standardStatsReducer(data, indexes, ignoreNulls, nullAsZero);
  return queue.map(calc => {
    const values = calc.standard
      ? standard.map((s: any) => s[calc.key])
      : calc.reducer!(data, indexes, ignoreNulls, nullAsZero);
    return {
      columns,
      rows: [values],
      type: 'table',
      columnMap: {},
    };
  });
}

// ------------------------------------------------------------------------------
//
//  No Exported symbols below here.
//
// ------------------------------------------------------------------------------

/**
 * This will return an array of valid indexes and throw an error if invalid request
 */
function verifyColumns(data: TableData, options: TableReducerOptions): number[] {
  const { columnIndexes } = options;
  if (!columnIndexes) {
    return data.columns.map((v, idx) => idx);
  }
  columnIndexes.forEach(v => {
    if (v < 0 || v >= data.columns.length) {
      throw new Error('Invalid column selection: ' + v);
    }
  });
  return columnIndexes;
}

interface StandardStats {
  sum: number | null; // total
  max: number | null;
  min: number | null;
  logmin: number;
  mean: number | null; // avg
  last: any; // current
  first: any;
  count: number;
  nonNullCount: number;
  range: number | null;
  diff: number | null;

  allIsZero: boolean;
  allIsNull: boolean;
}

const reducers: TableReducerInfo[] = [
  { key: 'sum', alias: 'total', name: 'Total', description: 'The sum of all values', standard: true },
  { key: 'min', name: 'Min', description: 'Minimum Value', standard: true },
  { key: 'max', name: 'Max', description: 'Maximum Value', standard: true },
  { key: 'mean', name: 'Mean', description: 'Average Value', standard: true, alias: 'avg' },
  { key: 'first', name: 'First', description: 'First Value', standard: true, reducer: getFirstRow },
  {
    key: 'last',
    name: 'Last',
    description: 'Last Value (current)',
    standard: true,
    alias: 'current',
    reducer: getLastRow,
  },
  { key: 'count', name: 'Count', description: 'Value Count', standard: true },
  { key: 'range', name: 'Range', description: 'Difference between minimum and maximum values', standard: true },
  { key: 'diff', name: 'Difference', description: 'Difference between first and last values', standard: true },
];

let registry: Map<string, TableReducerInfo> | null = null;

function standardStatsReducer(
  data: TableData,
  columnIndexes: number[],
  ignoreNulls: boolean,
  nullAsZero: boolean
): StandardStats[] {
  const column = columnIndexes.map(idx => {
    return {
      sum: 0,
      max: -Number.MAX_VALUE,
      min: Number.MAX_VALUE,
      logmin: Number.MAX_VALUE,
      mean: null,
      last: null,
      first: null,
      count: 0,
      nonNullCount: 0,
      allIsNull: true,
      allIsZero: false,
      range: null,
      diff: null,
    } as StandardStats;
  });

  for (let i = 0; i < data.rows.length; i++) {
    for (let x = 0; x < column.length; x++) {
      const stats = column[x];
      let currentValue = data.rows[i][x];

      if (currentValue === null) {
        if (ignoreNulls) {
          continue;
        }
        if (nullAsZero) {
          currentValue = 0;
        }
      }

      if (stats.first === null) {
        stats.first = currentValue;
      }

      if (currentValue !== null) {
        stats.last = currentValue;

        if (isNumber(currentValue)) {
          stats.sum! += currentValue;
          stats.allIsNull = false;
          stats.nonNullCount++;
        }

        if (currentValue > stats.max!) {
          stats.max = currentValue;
        }

        if (currentValue < stats.min!) {
          stats.min = currentValue;
        }

        if (currentValue < stats.logmin && currentValue > 0) {
          stats.logmin = currentValue;
        }

        if (currentValue !== 0) {
          stats.allIsZero = false;
        }
      }
    }
  }

  for (let x = 0; x < column.length; x++) {
    const stats = column[x];

    if (stats.max === -Number.MAX_VALUE) {
      stats.max = null;
    }

    if (stats.min === Number.MAX_VALUE) {
      stats.min = null;
    }

    if (stats.nonNullCount > 0) {
      stats.mean = stats.sum! / stats.nonNullCount;
    }

    if (stats.max !== null && stats.min !== null) {
      stats.range = stats.max - stats.min;
    }

    if (stats.first !== null && stats.last !== null) {
      if (isNumber(stats.first) && isNumber(stats.last)) {
        stats.diff = stats.last - stats.first;
      }
    }
  }

  return column;
}

function getFirstRow(data: TableData, columnIndexes: number[], ignoreNulls: boolean, nullAsZero: boolean): any[] {
  const row = data.rows[0];
  return columnIndexes.map(idx => row[idx]);
}

function getLastRow(data: TableData, columnIndexes: number[], ignoreNulls: boolean, nullAsZero: boolean): any[] {
  const row = data.rows[data.rows.length - 1];
  return columnIndexes.map(idx => row[idx]);
}
