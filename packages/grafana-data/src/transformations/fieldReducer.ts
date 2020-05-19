// Libraries
import isNumber from 'lodash/isNumber';

import { NullValueMode, Field, FieldState, FieldCalcs } from '../types/index';
import { Registry, RegistryItem } from '../utils/Registry';

export enum ReducerID {
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

  firstNotNull = 'firstNotNull',
  lastNotNull = 'lastNotNull',

  changeCount = 'changeCount',
  distinctCount = 'distinctCount',

  allIsZero = 'allIsZero',
  allIsNull = 'allIsNull',
}

// Internal function
type FieldReducer = (field: Field, ignoreNulls: boolean, nullAsZero: boolean) => FieldCalcs;

export interface FieldReducerInfo extends RegistryItem {
  // Internal details
  emptyInputResult?: any; // typically null, but some things like 'count' & 'sum' should be zero
  standard: boolean; // The most common stats can all be calculated in a single pass
  reduce?: FieldReducer;
}

interface ReduceFieldOptions {
  field: Field;
  reducers: string[]; // The stats to calculate
}

/**
 * @returns an object with a key for each selected stat
 */
export function reduceField(options: ReduceFieldOptions): FieldCalcs {
  const { field, reducers } = options;

  if (!field || !reducers || reducers.length < 1) {
    return {};
  }

  if (field.state?.calcs) {
    // Find the values we need to calculate
    const missing: string[] = [];
    for (const s of reducers) {
      if (!field.state.calcs.hasOwnProperty(s)) {
        missing.push(s);
      }
    }
    if (missing.length < 1) {
      return {
        ...field.state.calcs,
      };
    }
  }
  if (!field.state) {
    field.state = {} as FieldState;
  }

  const queue = fieldReducers.list(reducers);

  // Return early for empty series
  // This lets the concrete implementations assume at least one row
  const data = field.values;
  if (data.length < 1) {
    const calcs = { ...field.state.calcs } as FieldCalcs;
    for (const reducer of queue) {
      calcs[reducer.id] = reducer.emptyInputResult !== null ? reducer.emptyInputResult : null;
    }
    return (field.state.calcs = calcs);
  }

  const { nullValueMode } = field.config;
  const ignoreNulls = nullValueMode === NullValueMode.Ignore;
  const nullAsZero = nullValueMode === NullValueMode.AsZero;

  // Avoid calculating all the standard stats if possible
  if (queue.length === 1 && queue[0].reduce) {
    const values = queue[0].reduce(field, ignoreNulls, nullAsZero);
    field.state.calcs = {
      ...field.state.calcs,
      ...values,
    };
    return values;
  }

  // For now everything can use the standard stats
  let values = doStandardCalcs(field, ignoreNulls, nullAsZero);

  for (const reducer of queue) {
    if (!values.hasOwnProperty(reducer.id) && reducer.reduce) {
      values = {
        ...values,
        ...reducer.reduce(field, ignoreNulls, nullAsZero),
      };
    }
  }

  field.state.calcs = {
    ...field.state.calcs,
    ...values,
  };
  return values;
}

// ------------------------------------------------------------------------------
//
//  No Exported symbols below here.
//
// ------------------------------------------------------------------------------

export const fieldReducers = new Registry<FieldReducerInfo>(() => [
  {
    id: ReducerID.lastNotNull,
    name: 'Last (not null)',
    description: 'Last non-null value',
    standard: true,
    aliasIds: ['current'],
    reduce: calculateLastNotNull,
  },
  {
    id: ReducerID.last,
    name: 'Last',
    description: 'Last Value',
    standard: true,
    reduce: calculateLast,
  },
  { id: ReducerID.first, name: 'First', description: 'First Value', standard: true, reduce: calculateFirst },
  {
    id: ReducerID.firstNotNull,
    name: 'First (not null)',
    description: 'First non-null value',
    standard: true,
    reduce: calculateFirstNotNull,
  },
  { id: ReducerID.min, name: 'Min', description: 'Minimum Value', standard: true },
  { id: ReducerID.max, name: 'Max', description: 'Maximum Value', standard: true },
  { id: ReducerID.mean, name: 'Mean', description: 'Average Value', standard: true, aliasIds: ['avg'] },
  {
    id: ReducerID.sum,
    name: 'Total',
    description: 'The sum of all values',
    emptyInputResult: 0,
    standard: true,
    aliasIds: ['total'],
  },
  {
    id: ReducerID.count,
    name: 'Count',
    description: 'Number of values in response',
    emptyInputResult: 0,
    standard: true,
  },
  {
    id: ReducerID.range,
    name: 'Range',
    description: 'Difference between minimum and maximum values',
    standard: true,
  },
  {
    id: ReducerID.delta,
    name: 'Delta',
    description: 'Cumulative change in value',
    standard: true,
  },
  {
    id: ReducerID.step,
    name: 'Step',
    description: 'Minimum interval between values',
    standard: true,
  },
  {
    id: ReducerID.diff,
    name: 'Difference',
    description: 'Difference between first and last values',
    standard: true,
  },
  {
    id: ReducerID.logmin,
    name: 'Min (above zero)',
    description: 'Used for log min scale',
    standard: true,
  },
  {
    id: ReducerID.allIsZero,
    name: 'All Zeros',
    description: 'All values are zero',
    emptyInputResult: false,
    standard: true,
  },
  {
    id: ReducerID.allIsNull,
    name: 'All Nulls',
    description: 'All values are null',
    emptyInputResult: true,
    standard: true,
  },
  {
    id: ReducerID.changeCount,
    name: 'Change Count',
    description: 'Number of times the value changes',
    standard: false,
    reduce: calculateChangeCount,
  },
  {
    id: ReducerID.distinctCount,
    name: 'Distinct Count',
    description: 'Number of distinct values',
    standard: false,
    reduce: calculateDistinctCount,
  },
]);

export function doStandardCalcs(field: Field, ignoreNulls: boolean, nullAsZero: boolean): FieldCalcs {
  const calcs = {
    sum: 0,
    max: -Number.MAX_VALUE,
    min: Number.MAX_VALUE,
    logmin: Number.MAX_VALUE,
    mean: null,
    last: null,
    first: null,
    lastNotNull: null,
    firstNotNull: null,
    count: 0,
    nonNullCount: 0,
    allIsNull: true,
    allIsZero: true,
    range: null,
    diff: null,
    delta: 0,
    step: Number.MAX_VALUE,

    // Just used for calcutations -- not exposed as a stat
    previousDeltaUp: true,
  } as FieldCalcs;

  const data = field.values;
  calcs.count = data.length;

  for (let i = 0; i < data.length; i++) {
    let currentValue = data.get(i);

    if (i === 0) {
      calcs.first = currentValue;
    }

    calcs.last = currentValue;

    if (currentValue === null) {
      if (ignoreNulls) {
        continue;
      }
      if (nullAsZero) {
        currentValue = 0;
      }
    }

    if (currentValue !== null && currentValue !== undefined) {
      const isFirst = calcs.firstNotNull === null;
      if (isFirst) {
        calcs.firstNotNull = currentValue;
      }

      if (isNumber(currentValue)) {
        calcs.sum += currentValue;
        calcs.allIsNull = false;
        calcs.nonNullCount++;

        if (!isFirst) {
          const step = currentValue - calcs.lastNotNull!;
          if (calcs.step > step) {
            calcs.step = step; // the minimum interval
          }

          if (calcs.lastNotNull! > currentValue) {
            // counter reset
            calcs.previousDeltaUp = false;
            if (i === data.length - 1) {
              // reset on last
              calcs.delta += currentValue;
            }
          } else {
            if (calcs.previousDeltaUp) {
              calcs.delta += step; // normal increment
            } else {
              calcs.delta += currentValue; // account for counter reset
            }
            calcs.previousDeltaUp = true;
          }
        }

        if (currentValue > calcs.max) {
          calcs.max = currentValue;
        }

        if (currentValue < calcs.min) {
          calcs.min = currentValue;
        }

        if (currentValue < calcs.logmin && currentValue > 0) {
          calcs.logmin = currentValue;
        }
      }

      if (currentValue !== 0) {
        calcs.allIsZero = false;
      }

      calcs.lastNotNull = currentValue;
    }
  }

  if (calcs.max === -Number.MAX_VALUE) {
    calcs.max = null;
  }

  if (calcs.min === Number.MAX_VALUE) {
    calcs.min = null;
  }

  if (calcs.step === Number.MAX_VALUE) {
    calcs.step = null;
  }

  if (calcs.nonNullCount > 0) {
    calcs.mean = calcs.sum! / calcs.nonNullCount;
  }

  if (calcs.allIsNull) {
    calcs.allIsZero = false;
  }

  if (calcs.max !== null && calcs.min !== null) {
    calcs.range = calcs.max - calcs.min;
  }

  if (isNumber(calcs.firstNotNull) && isNumber(calcs.lastNotNull)) {
    calcs.diff = calcs.lastNotNull - calcs.firstNotNull;
  }

  return calcs;
}

function calculateFirst(field: Field, ignoreNulls: boolean, nullAsZero: boolean): FieldCalcs {
  return { first: field.values.get(0) };
}

function calculateFirstNotNull(field: Field, ignoreNulls: boolean, nullAsZero: boolean): FieldCalcs {
  const data = field.values;
  for (let idx = 0; idx < data.length; idx++) {
    const v = data.get(idx);
    if (v != null && v !== undefined) {
      return { firstNotNull: v };
    }
  }
  return { firstNotNull: null };
}

function calculateLast(field: Field, ignoreNulls: boolean, nullAsZero: boolean): FieldCalcs {
  const data = field.values;
  return { last: data.get(data.length - 1) };
}

function calculateLastNotNull(field: Field, ignoreNulls: boolean, nullAsZero: boolean): FieldCalcs {
  const data = field.values;
  let idx = data.length - 1;
  while (idx >= 0) {
    const v = data.get(idx--);
    if (v != null && v !== undefined) {
      return { lastNotNull: v };
    }
  }
  return { lastNotNull: null };
}

function calculateChangeCount(field: Field, ignoreNulls: boolean, nullAsZero: boolean): FieldCalcs {
  const data = field.values;
  let count = 0;
  let first = true;
  let last: any = null;
  for (let i = 0; i < data.length; i++) {
    let currentValue = data.get(i);
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

function calculateDistinctCount(field: Field, ignoreNulls: boolean, nullAsZero: boolean): FieldCalcs {
  const data = field.values;
  const distinct = new Set<any>();
  for (let i = 0; i < data.length; i++) {
    let currentValue = data.get(i);
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
