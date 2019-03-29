// Libraries
import isNumber from 'lodash/isNumber';

import { SeriesData, NullValueMode } from '../types/index';

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

  changeCount = 'changeCount',
  distinctCount = 'distinctCount',

  allIsZero = 'allIsZero',
  allIsNull = 'allIsNull',
}

export interface ColumnStats {
  [key: string]: any;
}

// Internal function
type StatCalculator = (data: SeriesData, fieldIndex: number, ignoreNulls: boolean, nullAsZero: boolean) => ColumnStats;

export interface StatCalculatorInfo {
  id: string;
  name: string;
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
  series: SeriesData;
  fieldIndex: number;
  stats: string[]; // The stats to calculate
  nullValueMode?: NullValueMode;
}

/**
 * @returns an object with a key for each selected stat
 */
export function calculateStats(options: CalculateStatsOptions): ColumnStats {
  const { series, fieldIndex, stats, nullValueMode } = options;

  if (!stats || stats.length < 1) {
    return {};
  }

  const queue = getStatsCalculators(stats);

  // Return early for empty series
  // This lets the concrete implementations assume at least one row
  if (!series.rows || series.rows.length < 1) {
    const stats = {} as ColumnStats;
    for (const stat of queue) {
      stats[stat.id] = stat.emptyInputResult !== null ? stat.emptyInputResult : null;
    }
    return stats;
  }

  const ignoreNulls = nullValueMode === NullValueMode.Ignore;
  const nullAsZero = nullValueMode === NullValueMode.AsZero;

  // Avoid calculating all the standard stats if possible
  if (queue.length === 1 && queue[0].calculator) {
    return queue[0].calculator(series, fieldIndex, ignoreNulls, nullAsZero);
  }

  // For now everything can use the standard stats
  let values = standardStatsStat(series, fieldIndex, ignoreNulls, nullAsZero);
  for (const calc of queue) {
    if (!values.hasOwnProperty(calc.id) && calc.calculator) {
      values = {
        ...values,
        ...calc.calculator(series, fieldIndex, ignoreNulls, nullAsZero),
      };
    }
  }
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
        id: StatID.last,
        name: 'Last',
        description: 'Last Value (current)',
        standard: true,
        alias: 'current',
        calculator: calculateLast,
      },
      { id: StatID.first, name: 'First', description: 'First Value', standard: true, calculator: calculateFirst },
      { id: StatID.min, name: 'Min', description: 'Minimum Value', standard: true },
      { id: StatID.max, name: 'Max', description: 'Maximum Value', standard: true },
      { id: StatID.mean, name: 'Mean', description: 'Average Value', standard: true, alias: 'avg' },
      {
        id: StatID.sum,
        name: 'Total',
        description: 'The sum of all values',
        emptyInputResult: 0,
        standard: true,
        alias: 'total',
      },
      {
        id: StatID.count,
        name: 'Count',
        description: 'Number of values in response',
        emptyInputResult: 0,
        standard: true,
      },
      {
        id: StatID.range,
        name: 'Range',
        description: 'Difference between minimum and maximum values',
        standard: true,
      },
      {
        id: StatID.delta,
        name: 'Delta',
        description: 'Cumulative change in value',
        standard: true,
      },
      {
        id: StatID.step,
        name: 'Step',
        description: 'Minimum interval between values',
        standard: true,
      },
      {
        id: StatID.diff,
        name: 'Difference',
        description: 'Difference between first and last values',
        standard: true,
      },
      {
        id: StatID.logmin,
        name: 'Min (above zero)',
        description: 'Used for log min scale',
        standard: true,
      },
      {
        id: StatID.changeCount,
        name: 'Change Count',
        description: 'Number of times the value changes',
        standard: false,
        calculator: calculateChangeCount,
      },
      {
        id: StatID.distinctCount,
        name: 'Distinct Count',
        description: 'Number of distinct values',
        standard: false,
        calculator: calculateDistinctCount,
      },
    ].forEach(info => {
      const { id, alias } = info;
      if (index.hasOwnProperty(id)) {
        console.warn('Duplicate Stat', id, info, index);
      }
      index[id] = info;
      if (alias) {
        if (index.hasOwnProperty(alias)) {
          console.warn('Duplicate Stat (alias)', alias, info, index);
        }
        index[alias] = info;
      }
      listOfStats.push(info);
    });
    hasBuiltIndex = true;
  }

  return index[id];
}

function standardStatsStat(
  data: SeriesData,
  fieldIndex: number,
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
    step: Number.MAX_VALUE,

    // Just used for calcutations -- not exposed as a stat
    previousDeltaUp: true,
  } as ColumnStats;

  for (let i = 0; i < data.rows.length; i++) {
    let currentValue = data.rows[i][fieldIndex];

    if (currentValue === null) {
      if (ignoreNulls) {
        continue;
      }
      if (nullAsZero) {
        currentValue = 0;
      }
    }

    if (currentValue !== null) {
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

  if (stats.step === Number.MAX_VALUE) {
    stats.step = null;
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

function calculateFirst(data: SeriesData, fieldIndex: number, ignoreNulls: boolean, nullAsZero: boolean): ColumnStats {
  return { first: data.rows[0][fieldIndex] };
}

function calculateLast(data: SeriesData, fieldIndex: number, ignoreNulls: boolean, nullAsZero: boolean): ColumnStats {
  return { last: data.rows[data.rows.length - 1][fieldIndex] };
}

function calculateChangeCount(
  data: SeriesData,
  fieldIndex: number,
  ignoreNulls: boolean,
  nullAsZero: boolean
): ColumnStats {
  let count = 0;
  let first = true;
  let last: any = null;
  for (let i = 0; i < data.rows.length; i++) {
    let currentValue = data.rows[i][fieldIndex];
    if (currentValue === null) {
      if (ignoreNulls) {
        continue;
      }
      if (nullAsZero) {
        currentValue = 0;
      }
    }
    if (!first && last !== currentValue) {
      count++;
    }
    first = false;
    last = currentValue;
  }

  return { changeCount: count };
}

function calculateDistinctCount(
  data: SeriesData,
  fieldIndex: number,
  ignoreNulls: boolean,
  nullAsZero: boolean
): ColumnStats {
  const distinct = new Set<any>();
  for (let i = 0; i < data.rows.length; i++) {
    let currentValue = data.rows[i][fieldIndex];
    if (currentValue === null) {
      if (ignoreNulls) {
        continue;
      }
      if (nullAsZero) {
        currentValue = 0;
      }
    }
    distinct.add(currentValue);
  }
  return { distinctCount: distinct.size };
}
