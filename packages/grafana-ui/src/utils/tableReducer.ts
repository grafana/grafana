// Libraries
import isNumber from 'lodash/isNumber';

import { TableData, NullValueMode } from '../types/index';

export enum TableReducerID {
  sum = 'sum',
  max = 'max',
  min = 'min',
  logmin = 'logmin',
  mean = 'mean',
  last = 'last',
  first = 'first',
  count = 'count',
  range = 'range',
  diff = 'diff',
  delta = 'delta',
  step = 'step',

  allIsZero = 'allIsZero',
  allIsNull = 'allIsNull',
}

/** Information about the reducing(stats) functions  */
export interface TableReducerInfo {
  value: string; // The ID - value maps directly to select component
  label: string; // The name - label
  description: string;
  alias?: string; // optional secondary key.  'avg' vs 'mean', 'total' vs 'sum'

  // Internal details
  emptyInputResult?: any; // typically null, but some things like 'count' & 'sum' should be zero
  standard: boolean; // The most common stats can all be calculated in a single pass
  reducer?: TableReducer;
}

/**
 * Get a list of the known reducing functions
 * @param ids list of reducer names or null to get all of them
 * @param notFound optional error object that will be filled with the names on unknown reducers
 */
export function getTableReducers(ids?: string[], notFound?: string[]): TableReducerInfo[] {
  if (ids === null || ids === undefined) {
    return listOfReducers;
  }
  return ids.reduce((list, id) => {
    const reducer = getById(id);
    if (reducer) {
      list.push(reducer);
    } else if (notFound && id) {
      notFound.push(id);
    }
    return list;
  }, new Array<TableReducerInfo>());
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

  const queue = getTableReducers(options.stats);

  // Return early for empty tables
  // This lets the concrete implementations assume at least one row
  if (!data.rows || data.rows.length < 1) {
    return queue.map(stat => {
      return {
        columns,
        rows: [indexes.map(v => stat.emptyInputResult)],
        type: 'table',
        columnMap: {},
      };
    });
  }

  // Avoid calculating all the standard stats if possible
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
      ? standard.map((s: any) => s[calc.value])
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

type TableReducer = (data: TableData, columnIndexes: number[], ignoreNulls: boolean, nullAsZero: boolean) => any[];

// private registry of all reducers
interface TableReducerIndex {
  [id: string]: TableReducerInfo;
}
const listOfReducers: TableReducerInfo[] = [];
const index: TableReducerIndex = {};
let hasBuiltIndex = false;

function getById(id: string): TableReducerInfo | undefined {
  if (!hasBuiltIndex) {
    [
      {
        value: TableReducerID.last,
        label: 'Last',
        description: 'Last Value (current)',
        standard: true,
        alias: 'current',
        reducer: getLastRow,
      },
      { value: TableReducerID.first, label: 'First', description: 'First Value', standard: true, reducer: getFirstRow },
      { value: TableReducerID.min, label: 'Min', description: 'Minimum Value', standard: true },
      { value: TableReducerID.max, label: 'Max', description: 'Maximum Value', standard: true },
      { value: TableReducerID.mean, label: 'Mean', description: 'Average Value', standard: true, alias: 'avg' },
      {
        value: TableReducerID.sum,
        label: 'Total',
        description: 'The sum of all values',
        emptyInputResult: 0,
        standard: true,
        alias: 'total',
      },
      { value: TableReducerID.count, label: 'Count', description: 'Value Count', emptyInputResult: 0, standard: true },
      {
        value: TableReducerID.range,
        label: 'Range',
        description: 'Difference between minimum and maximum values',
        standard: true,
      },
      {
        value: TableReducerID.delta,
        label: 'Delta',
        description: 'Cumulative change in value', // HELP! not totally sure what this does
        standard: true,
      },
      {
        value: TableReducerID.step,
        label: 'Step',
        description: 'Minimum interval between values',
        standard: true,
      },
      {
        value: TableReducerID.diff,
        label: 'Difference',
        description: 'Difference between first and last values',
        standard: true,
      },
      {
        value: TableReducerID.logmin,
        label: 'Min (above zero)',
        description: 'Used for log min scale',
        standard: true,
      },
    ].forEach(calc => {
      const { value, alias } = calc;
      if (index.hasOwnProperty(value)) {
        console.warn('Duplicate Reducer', value, calc, index);
      }
      index[value] = calc;
      if (alias) {
        if (index.hasOwnProperty(alias)) {
          console.warn('Duplicate Reducer (alias)', alias, calc, index);
        }
        index[alias] = calc;
      }
      listOfReducers.push(calc);
    });
    hasBuiltIndex = true;
  }
  return index[id];
}

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
  delta: number | null;
  step: number | null;
  allIsZero: boolean;
  allIsNull: boolean;
}

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
      delta: 0,
      step: 0,

      // Just used for calcutations -- not exposed as a reducer
      previousDeltaUp: true,
    };
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

      if (currentValue !== null) {
        stats.last = currentValue;

        const isFirst = stats.first === null;
        if (isFirst) {
          stats.first = currentValue;
        }

        if (isNumber(currentValue)) {
          stats.sum += currentValue;
          stats.allIsNull = false;
          stats.nonNullCount++;

          if (!isFirst) {
            const step = currentValue - stats.last!;
            if (stats.step > step) {
              stats.step = step; // the minimum interval
            }

            if (stats.last! > currentValue) {
              // counter reset
              stats.previousDeltaUp = false;
              if (i === data.rows.length - 1) {
                // reset on last
                stats.delta += currentValue;
              }
            } else {
              if (stats.previousDeltaUp) {
                stats.delta += step; // normal increment
              } else {
                stats.delta += currentValue; // account for counter reset
              }
              stats.previousDeltaUp = true;
            }
          }

          if (currentValue > stats.max) {
            stats.max = currentValue;
          }

          if (currentValue < stats.min) {
            stats.min = currentValue;
          }

          if (currentValue < stats.logmin && currentValue > 0) {
            stats.logmin = currentValue;
          }
        }

        if (currentValue !== 0) {
          stats.allIsZero = false;
        }

        stats.last = currentValue;
      }
    }
  }

  for (let x = 0; x < column.length; x++) {
    const stats = column[x] as StandardStats;

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
