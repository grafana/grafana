// Libraries
import { isNumber } from 'lodash';

import { NullValueMode } from '../types/data';
import { Field, FieldCalcs, FieldType } from '../types/dataFrame';
import { Registry, RegistryItem } from '../utils/Registry';

export enum ReducerID {
  sum = 'sum',
  max = 'max',
  min = 'min',
  logmin = 'logmin',
  mean = 'mean',
  variance = 'variance',
  stdDev = 'stdDev',
  last = 'last',
  median = 'median',
  first = 'first',
  count = 'count',
  countAll = 'countAll',
  range = 'range',
  diff = 'diff',
  diffperc = 'diffperc',
  delta = 'delta',
  step = 'step',
  firstNotNull = 'firstNotNull',
  lastNotNull = 'lastNotNull',
  changeCount = 'changeCount',
  distinctCount = 'distinctCount',
  allIsZero = 'allIsZero',
  allIsNull = 'allIsNull',
  allValues = 'allValues',
  uniqueValues = 'uniqueValues',
  p1 = 'p1',
  p2 = 'p2',
  p3 = 'p3',
  p4 = 'p4',
  p5 = 'p5',
  p6 = 'p6',
  p7 = 'p7',
  p8 = 'p8',
  p9 = 'p9',
  p10 = 'p10',
  p11 = 'p11',
  p12 = 'p12',
  p13 = 'p13',
  p14 = 'p14',
  p15 = 'p15',
  p16 = 'p16',
  p17 = 'p17',
  p18 = 'p18',
  p19 = 'p19',
  p20 = 'p20',
  p21 = 'p21',
  p22 = 'p22',
  p23 = 'p23',
  p24 = 'p24',
  p25 = 'p25',
  p26 = 'p26',
  p27 = 'p27',
  p28 = 'p28',
  p29 = 'p29',
  p30 = 'p30',
  p31 = 'p31',
  p32 = 'p32',
  p33 = 'p33',
  p34 = 'p34',
  p35 = 'p35',
  p36 = 'p36',
  p37 = 'p37',
  p38 = 'p38',
  p39 = 'p39',
  p40 = 'p40',
  p41 = 'p41',
  p42 = 'p42',
  p43 = 'p43',
  p44 = 'p44',
  p45 = 'p45',
  p46 = 'p46',
  p47 = 'p47',
  p48 = 'p48',
  p49 = 'p49',
  p50 = 'p50',
  p51 = 'p51',
  p52 = 'p52',
  p53 = 'p53',
  p54 = 'p54',
  p55 = 'p55',
  p56 = 'p56',
  p57 = 'p57',
  p58 = 'p58',
  p59 = 'p59',
  p60 = 'p60',
  p61 = 'p61',
  p62 = 'p62',
  p63 = 'p63',
  p64 = 'p64',
  p65 = 'p65',
  p66 = 'p66',
  p67 = 'p67',
  p68 = 'p68',
  p69 = 'p69',
  p70 = 'p70',
  p71 = 'p71',
  p72 = 'p72',
  p73 = 'p73',
  p74 = 'p74',
  p75 = 'p75',
  p76 = 'p76',
  p77 = 'p77',
  p78 = 'p78',
  p79 = 'p79',
  p80 = 'p80',
  p81 = 'p81',
  p82 = 'p82',
  p83 = 'p83',
  p84 = 'p84',
  p85 = 'p85',
  p86 = 'p86',
  p87 = 'p87',
  p88 = 'p88',
  p89 = 'p89',
  p90 = 'p90',
  p91 = 'p91',
  p92 = 'p92',
  p93 = 'p93',
  p94 = 'p94',
  p95 = 'p95',
  p96 = 'p96',
  p97 = 'p97',
  p98 = 'p98',
  p99 = 'p99',
}

export function getFieldTypeForReducer(id: ReducerID, fallback: FieldType): FieldType {
  return id === ReducerID.count ||
    id === ReducerID.distinctCount ||
    id === ReducerID.changeCount ||
    id === ReducerID.countAll
    ? FieldType.number
    : id === ReducerID.allIsNull || id === ReducerID.allIsZero
      ? FieldType.boolean
      : fallback;
}

export function isReducerID(id: string): id is ReducerID {
  return Object.keys(ReducerID).includes(id);
}

// Internal function
type FieldReducer = (field: Field, ignoreNulls: boolean, nullAsZero: boolean) => FieldCalcs;

export interface FieldReducerInfo extends RegistryItem {
  // Internal details
  emptyInputResult?: unknown; // typically null, but some things like 'count' & 'sum' should be zero
  standard: boolean; // The most common stats can all be calculated in a single pass
  preservesUnits: boolean; // Whether this reducer preserves units, certain ones don't e.g. count, distinct count, etc,
  reduce?: FieldReducer;
}

interface ReduceFieldOptions {
  field: Field;
  reducers: string[]; // The stats to calculate
}

/**
 * @returns an object with a key for each selected stat
 * NOTE: This will also modify the 'field.state' object,
 * leaving values in a cache until cleared.
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
    field.state = {};
  }

  const queue = fieldReducers.list(reducers);

  // Return early for empty series
  // This lets the concrete implementations assume at least one row
  const data = field.values;
  if (data && data.length < 1) {
    const calcs: FieldCalcs = { ...field.state.calcs };
    for (const reducer of queue) {
      calcs[reducer.id] = reducer.emptyInputResult !== null ? reducer.emptyInputResult : null;
    }
    return (field.state.calcs = calcs);
  }

  // Default to Ignore for nullValueMode.
  const { nullValueMode = NullValueMode.Ignore } = field.config;

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
    name: 'Last *',
    description: 'Last non-null value (also excludes NaNs)',
    standard: true,
    aliasIds: ['current'],
    reduce: calculateLastNotNull,
    preservesUnits: true,
  },
  {
    id: ReducerID.last,
    name: 'Last',
    description: 'Last value',
    standard: true,
    reduce: calculateLast,
    preservesUnits: true,
  },
  {
    id: ReducerID.firstNotNull,
    name: 'First *',
    description: 'First non-null value (also excludes NaNs)',
    standard: true,
    reduce: calculateFirstNotNull,
    preservesUnits: true,
  },
  {
    id: ReducerID.first,
    name: 'First',
    description: 'First Value',
    standard: true,
    reduce: calculateFirst,
    preservesUnits: true,
  },
  { id: ReducerID.min, name: 'Min', description: 'Minimum Value', standard: true, preservesUnits: true },
  { id: ReducerID.max, name: 'Max', description: 'Maximum Value', standard: true, preservesUnits: true },
  {
    id: ReducerID.mean,
    name: 'Mean',
    description: 'Average Value',
    standard: true,
    aliasIds: ['avg'],
    preservesUnits: true,
  },
  {
    id: ReducerID.median,
    name: 'Median',
    description: 'Median Value',
    standard: false,
    reduce: calculateMedian,
    aliasIds: ['median'],
    preservesUnits: true,
  },
  {
    id: ReducerID.variance,
    name: 'Variance',
    description: 'Variance of all values in a field',
    standard: false,
    reduce: calculateStdDev,
    preservesUnits: true,
  },
  {
    id: ReducerID.stdDev,
    name: 'StdDev',
    description: 'Standard deviation of all values in a field',
    standard: false,
    reduce: calculateStdDev,
    preservesUnits: true,
  },
  {
    id: ReducerID.sum,
    name: 'Total',
    description: 'The sum of all values',
    emptyInputResult: 0,
    standard: true,
    aliasIds: ['total'],
    preservesUnits: true,
  },
  {
    id: ReducerID.count,
    name: 'Count',
    description: 'Number of values in response',
    emptyInputResult: 0,
    standard: true,
    preservesUnits: false,
  },
  {
    id: ReducerID.countAll,
    name: 'Count all',
    description: 'Number of values (including empty)',
    emptyInputResult: 0,
    standard: false,
    reduce: (field: Field): FieldCalcs => ({ countAll: field.values.length }),
    preservesUnits: false,
  },
  {
    id: ReducerID.range,
    name: 'Range',
    description: 'Difference between minimum and maximum values',
    standard: true,
    preservesUnits: true,
  },
  {
    id: ReducerID.delta,
    name: 'Delta',
    description: 'Cumulative change in value',
    standard: true,
    preservesUnits: true,
  },
  {
    id: ReducerID.step,
    name: 'Step',
    description: 'Minimum interval between values',
    standard: true,
    preservesUnits: true,
  },
  {
    id: ReducerID.diff,
    name: 'Difference',
    description: 'Difference between first and last values',
    standard: true,
    preservesUnits: true,
  },
  {
    id: ReducerID.logmin,
    name: 'Min (above zero)',
    description: 'Used for log min scale',
    standard: true,
    preservesUnits: true,
  },
  {
    id: ReducerID.allIsZero,
    name: 'All Zeros',
    description: 'All values are zero',
    emptyInputResult: false,
    standard: true,
    preservesUnits: true,
  },
  {
    id: ReducerID.allIsNull,
    name: 'All Nulls',
    description: 'All values are null',
    emptyInputResult: true,
    standard: true,
    preservesUnits: false,
  },
  {
    id: ReducerID.changeCount,
    name: 'Change Count',
    description: 'Number of times the value changes',
    standard: false,
    reduce: calculateChangeCount,
    preservesUnits: false,
  },
  {
    id: ReducerID.distinctCount,
    name: 'Distinct Count',
    description: 'Number of distinct values',
    standard: false,
    reduce: calculateDistinctCount,
    preservesUnits: false,
  },
  {
    id: ReducerID.diffperc,
    name: 'Difference percent',
    description: 'Percentage difference between first and last values',
    standard: true,
    preservesUnits: false,
  },
  {
    id: ReducerID.allValues,
    name: 'All values',
    description: 'Returns an array with all values',
    standard: false,
    reduce: (field: Field) => ({ allValues: [...field.values] }),
    preservesUnits: false,
  },
  {
    id: ReducerID.uniqueValues,
    name: 'All unique values',
    description: 'Returns an array with all unique values',
    standard: false,
    reduce: (field: Field) => ({
      uniqueValues: [...new Set(field.values)],
    }),
    preservesUnits: false,
  },
  ...buildPercentileReducers(),
]);

// This `Array.from` will build an array of elements from 1 to 99
const buildPercentileReducers = (percentiles = [...Array.from({ length: 99 }, (_, i) => i + 1)]) => {
  const percentileReducers: FieldReducerInfo[] = [];
  const nth = (n: number) =>
    n > 3 && n < 21 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';

  percentiles.forEach((p) => {
    const percentile = p / 100;
    const id = `p${p}`;
    const name = `${p}${nth(p)} %`;
    const description = `${p}${nth(p)} percentile value`;

    percentileReducers.push({
      id: id,
      name: name,
      description: description,
      standard: false,
      reduce: (field: Field, ignoreNulls: boolean, nullAsZero: boolean): FieldCalcs => {
        return { [id]: calculatePercentile(field, percentile, ignoreNulls, nullAsZero) };
      },
      preservesUnits: true,
    });
  });
  return percentileReducers;
};

// Used for test cases
export const defaultCalcs: FieldCalcs = {
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
  diffperc: 0,
  // Just used for calculations -- not exposed as a stat
  previousDeltaUp: true,
};

export function doStandardCalcs(field: Field, ignoreNulls: boolean, nullAsZero: boolean): FieldCalcs {
  const calcs: FieldCalcs = { ...defaultCalcs };

  const data = field.values;

  // early return for undefined / empty series
  if (!data) {
    return calcs;
  }

  const isNumberField = field.type === FieldType.number || field.type === FieldType.time;

  for (let i = 0; i < data.length; i++) {
    let currentValue = data[i];

    if (i === 0) {
      calcs.first = currentValue;
    }

    calcs.last = currentValue;

    if (currentValue == null) {
      if (ignoreNulls) {
        continue;
      }
      if (nullAsZero) {
        currentValue = 0;
      }
    }

    calcs.count++;

    if (currentValue != null && !Number.isNaN(currentValue)) {
      // null || undefined || NaN
      const isFirst = calcs.firstNotNull === null;
      if (isFirst) {
        calcs.firstNotNull = currentValue;
      }

      if (isNumberField) {
        calcs.sum += currentValue || 0;
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
          } else {
            if (calcs.previousDeltaUp) {
              calcs.delta += step; // normal increment
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

  if (isNumber(calcs.firstNotNull) && isNumber(calcs.diff)) {
    calcs.diffperc = (calcs.diff / calcs.firstNotNull) * 100;
  }

  return calcs;
}

function calculateFirst(field: Field, ignoreNulls: boolean, nullAsZero: boolean): FieldCalcs {
  return { first: field.values[0] };
}

function calculateFirstNotNull(field: Field, ignoreNulls: boolean, nullAsZero: boolean): FieldCalcs {
  const data = field.values;
  for (let idx = 0; idx < data.length; idx++) {
    const v = data[idx];
    if (v != null && !Number.isNaN(v)) {
      return { firstNotNull: v };
    }
  }
  return { firstNotNull: null };
}

function calculateLast(field: Field, ignoreNulls: boolean, nullAsZero: boolean): FieldCalcs {
  const data = field.values;
  return { last: data[data.length - 1] };
}

function calculateLastNotNull(field: Field, ignoreNulls: boolean, nullAsZero: boolean): FieldCalcs {
  const data = field.values;
  let idx = data.length - 1;
  while (idx >= 0) {
    const v = data[idx--];
    if (v != null && !Number.isNaN(v)) {
      return { lastNotNull: v };
    }
  }
  return { lastNotNull: null };
}

/** Calculates standard deviation and variance */
function calculateStdDev(field: Field, ignoreNulls: boolean, nullAsZero: boolean): FieldCalcs {
  // Only support number fields
  if (!(field.type === FieldType.number || field.type === FieldType.time)) {
    return { variance: 0, stdDev: 0 };
  }

  let squareSum = 0;
  let runningMean = 0;
  let runningNonNullCount = 0;
  const data = field.values;
  for (let i = 0; i < data.length; i++) {
    const currentValue = data[i];
    if (currentValue != null) {
      runningNonNullCount++;
      let _oldMean = runningMean;
      runningMean += (currentValue - _oldMean) / runningNonNullCount;
      squareSum += (currentValue - _oldMean) * (currentValue - runningMean);
    }
  }
  if (runningNonNullCount > 0) {
    const variance = squareSum / runningNonNullCount;
    return { variance, stdDev: Math.sqrt(variance) };
  }
  return { variance: 0, stdDev: 0 };
}

function calculateChangeCount(field: Field, ignoreNulls: boolean, nullAsZero: boolean): FieldCalcs {
  const data = field.values;
  let count = 0;
  let first = true;
  let last = null;
  for (let i = 0; i < data.length; i++) {
    let currentValue = data[i];
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
  const distinct = new Set();
  for (let i = 0; i < data.length; i++) {
    let currentValue = data[i];
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

function calculatePercentile(field: Field, percentile: number, ignoreNulls: boolean, nullAsZero: boolean): number {
  let data = field.values;

  if (ignoreNulls) {
    data = data.filter((value) => value !== null);
  }
  if (nullAsZero) {
    data = data.map((value) => (value === null ? 0 : value));
  }

  const sorted = data.slice().sort((a, b) => a - b);
  const index = Math.round((sorted.length - 1) * percentile);
  return sorted[index];
}

function calculateMedian(field: Field<number>, ignoreNulls: boolean, nullAsZero: boolean): FieldCalcs {
  const numbers: number[] = [];

  for (let i = 0; i < field.values.length; i++) {
    let currentValue = field.values[i];

    if (currentValue == null) {
      if (ignoreNulls) {
        continue;
      }
      if (nullAsZero) {
        currentValue = 0;
      }
    }

    numbers.push(currentValue);
  }

  numbers.sort((a, b) => a - b);

  const mid = Math.floor(numbers.length / 2);

  if (numbers.length % 2 === 0) {
    return { median: (numbers[mid - 1] + numbers[mid]) / 2 };
  } else {
    return { median: numbers[mid] };
  }
}
