// Libraries
import isNumber from 'lodash/isNumber';

import { TableData, NullValueMode } from '../types/index';

export enum StatID {
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

export interface ColumnStats {
  [key: string]: any;
}

// Internal function
type StatCalculator = (data: TableData, columnIndex: number, ignoreNulls: boolean, nullAsZero: boolean) => ColumnStats;

export interface StatCalculatorInfo {
  value: string; // The ID - value maps directly to select component
  label: string; // The name - label for Select component
  description: string;
  alias?: string; // optional secondary key.  'avg' vs 'mean', 'total' vs 'sum'

  // Internal details
  emptyInputResult?: any; // typically null, but some things like 'count' & 'sum' should be zero
  standard: boolean; // The most common stats can all be calculated in a single pass
  calculator?: StatCalculator;
}

/**
 * @param ids list of stat names or null to get all of them
 */
export function getStatsCalculators(ids?: string[]): StatCalculatorInfo[] {
  if (ids === null || ids === undefined) {
    if (!hasBuiltIndex) {
      getById(StatID.mean);
    }
    return listOfStats;
  }
  return ids.reduce((list, id) => {
    const stat = getById(id);
    if (stat) {
      list.push(stat);
    }
    return list;
  }, new Array<StatCalculatorInfo>());
}

export interface CalculateStatsOptions {
  data: TableData;
  columnIndex: number;
  stats: string[]; // The stats to calculate
  nullValueMode?: NullValueMode;
}

/**
 * @returns an object with a key for each selected stat
 */
export function calculateStats(options: CalculateStatsOptions): ColumnStats {
  const { data, columnIndex, stats, nullValueMode } = options;

  if (!stats || stats.length < 1) {
    return {};
  }

  const queue = getStatsCalculators(stats);

  // Return early for empty tables
  // This lets the concrete implementations assume at least one row
  if (!data.rows || data.rows.length < 1) {
    const stats = {} as ColumnStats;
    queue.forEach(stat => {
      stats[stat.value] = stat.emptyInputResult !== null ? stat.emptyInputResult : null;
    });
    return stats;
  }

  const ignoreNulls = nullValueMode === NullValueMode.Ignore;
  const nullAsZero = nullValueMode === NullValueMode.AsZero;

  // Avoid calculating all the standard stats if possible
  if (queue.length === 1 && queue[0].calculator) {
    return [queue[0].calculator(data, columnIndex, ignoreNulls, nullAsZero)];
  }

  // For now everything can use the standard stats
  let values = standardStatsStat(data, columnIndex, ignoreNulls, nullAsZero);
  queue.forEach(calc => {
    if (!values.hasOwnProperty(calc.value) && calc.calculator) {
      values = {
        ...values,
        ...calc.calculator(data, columnIndex, ignoreNulls, nullAsZero),
      };
    }
  });
  return values;
}

// ------------------------------------------------------------------------------
//
//  No Exported symbols below here.
//
// ------------------------------------------------------------------------------

// private registry of all stats
interface TableStatIndex {
  [id: string]: StatCalculatorInfo;
}
const listOfStats: StatCalculatorInfo[] = [];
const index: TableStatIndex = {};
let hasBuiltIndex = false;

function getById(id: string): StatCalculatorInfo | undefined {
  if (!hasBuiltIndex) {
    [
      {
        value: StatID.last,
        label: 'Last',
        description: 'Last Value (current)',
        standard: true,
        alias: 'current',
        stat: calculateLast,
      },
      { value: StatID.first, label: 'First', description: 'First Value', standard: true, stat: calculateFirst },
      { value: StatID.min, label: 'Min', description: 'Minimum Value', standard: true },
      { value: StatID.max, label: 'Max', description: 'Maximum Value', standard: true },
      { value: StatID.mean, label: 'Mean', description: 'Average Value', standard: true, alias: 'avg' },
      {
        value: StatID.sum,
        label: 'Total',
        description: 'The sum of all values',
        emptyInputResult: 0,
        standard: true,
        alias: 'total',
      },
      {
        value: StatID.count,
        label: 'Count',
        description: 'Number of values in response',
        emptyInputResult: 0,
        standard: true,
      },
      {
        value: StatID.range,
        label: 'Range',
        description: 'Difference between minimum and maximum values',
        standard: true,
      },
      {
        value: StatID.delta,
        label: 'Delta',
        description: 'Cumulative change in value (??? help not really sure ???)',
        standard: true,
      },
      {
        value: StatID.step,
        label: 'Step',
        description: 'Minimum interval between values',
        standard: true,
      },
      {
        value: StatID.diff,
        label: 'Difference',
        description: 'Difference between first and last values',
        standard: true,
      },
      {
        value: StatID.logmin,
        label: 'Min (above zero)',
        description: 'Used for log min scale',
        standard: true,
      },
    ].forEach(calc => {
      const { value, alias } = calc;
      if (index.hasOwnProperty(value)) {
        console.warn('Duplicate Stat', value, calc, index);
      }
      index[value] = calc;
      if (alias) {
        if (index.hasOwnProperty(alias)) {
          console.warn('Duplicate Stat (alias)', alias, calc, index);
        }
        index[alias] = calc;
      }
      listOfStats.push(calc);
    });
    hasBuiltIndex = true;
  }
  return index[id];
}

function standardStatsStat(
  data: TableData,
  columnIndex: number,
  ignoreNulls: boolean,
  nullAsZero: boolean
): ColumnStats {
  const stats = {
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

    // Just used for calcutations -- not exposed as a stat
    previousDeltaUp: true,
  } as ColumnStats;

  for (let i = 0; i < data.rows.length; i++) {
    let currentValue = data.rows[i][columnIndex];

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

  return stats;
}

function calculateFirst(data: TableData, columnIndex: number, ignoreNulls: boolean, nullAsZero: boolean): ColumnStats {
  return { first: data.rows[0][columnIndex] };
}

function calculateLast(data: TableData, columnIndex: number, ignoreNulls: boolean, nullAsZero: boolean): ColumnStats {
  return { last: data.rows[data.rows.length - 1][columnIndex] };
}
