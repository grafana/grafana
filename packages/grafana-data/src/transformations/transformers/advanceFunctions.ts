/*
BMC File
Author - Murtuza Ahmedi
*/
import { map } from 'rxjs/operators';

import { getFieldDisplayName } from '../..';
import { DataFrame, FieldType, Field } from '../../types/dataFrame';
import { DataTransformerInfo, FieldMatcher, DataTransformContext } from '../../types/transformations';
import { reduceField, ReducerID } from '../fieldReducer';
import { getFieldMatcher } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';

import { ensureColumnsTransformer } from './ensureColumns';
import {
  FilterByValueTransformerOptions,
  FilterByValueType,
  FilterByValueMatch,
  filterDataByValues,
} from './filterByValue';
import { DataTransformerID } from './ids';
import { sortDataFrames } from './sortBy';

export enum AdvFuncList {
  AccumulativeTotal = 'accumulativeTotal',
  AccumulativePercentage = 'accumulativePercentage',
  PercentageAgainstMaximumValue = 'percentageAgainstMaximumValue',
  PercentageAgainstInitialValue = 'percentageAgainstInitialValue',
  PercentageAgainstColumn = 'percentageAgainstColumn',
  PercentageChangeAgainstColumn = 'percentageChangeAgainstColumn',
  DeltaFromLastN = 'deltaFromLastN',
  PercentageAgainstTotal = 'percentageAgainstTotal',
  Percentile = 'percentile',
  TopNRank = 'topNRank',
}

export interface PercentageAgainstMaxOptions {
  fieldName: string;
  maxValue: number;
}

export interface AdvFuncTransformerOptions {
  functionName: AdvFuncList;
  fieldName: string;
  functionLabel: string;
  againstField?: string;
  numberOfPrevRows?: number;
  isDeltaFromLastPercentage?: boolean;
  percentile: number;
  rank: number;
  TopNAlias: string;
}

type ValuesCreator = (data: DataFrame) => any[];

export const advanceFunctionsTransformer: DataTransformerInfo<AdvFuncTransformerOptions> = {
  id: DataTransformerID.advanceFunctions,
  name: 'Advanced functions',
  description:
    'Transform results by applying post-processing calculations to the initial query results. For example, Accumulative total, Percentage against maximum value, and so on.',
  defaultOptions: {
    functionName: AdvFuncList.AccumulativeTotal,
    functionLabel: 'Accumulative total',
    fieldName: '',
  },
  operator: (options, ctx) => (source) => {
    const operator = ensureColumnsTransformer.operator(null, ctx);
    return source.pipe(
      operator,
      map((data) => {
        if (!isFieldSeletected(options.fieldName, options.functionName, options.againstField)) {
          return data;
        }

        if (options.functionName === AdvFuncList.Percentile) {
          let matcher = getFieldMatcher({
            id: FieldMatcherID.byName,
            options: options.fieldName,
          });
          return reducedPercentileRow(data, matcher, options, ctx);
        }

        // Sort the data frame in descending order to assign rank
        if (options.functionName === AdvFuncList.TopNRank) {
          data = sortDataFrames(data, [{ field: options.fieldName, desc: true }], ctx);
        }

        let creator: ValuesCreator | undefined = undefined;
        let functionName = options.functionName ?? AdvFuncList.PercentageAgainstMaximumValue;
        creator = getValueCreator(options, data, functionName);

        // Nothing configured
        if (!creator) {
          return data;
        }

        const fieldName =
          options.functionName === AdvFuncList.TopNRank
            ? options.TopNAlias || options.functionLabel + ' of ' + options.fieldName
            : options.functionLabel;
        data = data.map((frame) => {
          // delegate field creation to the specific function
          const values = creator!(frame);
          if (!values) {
            return frame;
          }

          const field: Field = {
            name: fieldName,
            type: FieldType.number,
            config: { decimals: showDecimals(functionName, options) ? 2 : null },
            values,
          };
          let fields: Field[] = [];

          fields = [...frame.fields, field];
          return {
            ...frame,
            fields,
          };
        });

        // filter data if N value is provided for top N Rank
        if (options.functionName === AdvFuncList.TopNRank && options.rank > 0) {
          data = filterDataFrameByRank(data, options, fieldName);
        }
        return data;
      })
    );
  },
};

const showDecimals = (functionName: string, options: AdvFuncTransformerOptions): boolean => {
  return (
    functionName === AdvFuncList.PercentageAgainstInitialValue ||
    functionName === AdvFuncList.PercentageAgainstMaximumValue ||
    functionName === AdvFuncList.AccumulativePercentage ||
    functionName === AdvFuncList.PercentageAgainstColumn ||
    functionName === AdvFuncList.PercentageChangeAgainstColumn ||
    functionName === AdvFuncList.PercentageAgainstTotal ||
    (functionName === AdvFuncList.DeltaFromLastN && (options.isDeltaFromLastPercentage ?? false))
  );
};

const isFieldSeletected = (fieldName: string, functionName: string, againstField?: string): boolean => {
  if (
    !fieldName ||
    (functionName === AdvFuncList.PercentageAgainstColumn && !againstField) ||
    (functionName === AdvFuncList.PercentageChangeAgainstColumn && !againstField)
  ) {
    return false;
  }
  return true;
};

const generatePercentage = (field: Field, divisor = 1, i: number): number => {
  if (divisor === 0) {
    divisor = 1;
  }
  let percent = 0;
  const currentValue = getFieldValue(field, i);
  percent = percentReducer(currentValue, divisor);
  return !isNaN(percent) ? percent : 0;
};

const percentReducer = (dividend: number, divisor: number): number => {
  if (!divisor) {
    return 0;
  }
  return (dividend / divisor) * 100;
};

const getFieldValue = (field: Field, i: number): number => {
  let currentValue = field.values[i];
  currentValue = currentValue || 0;
  return currentValue;
};

const generateAccumulations = (frame: DataFrame, row: Field, functionName: string, columnSum?: number): number[] => {
  let accumulativeTotals = [];
  let accumulativeTotalsPercentage = [];
  for (let i = 0; i < frame.length; i++) {
    let val = getFieldValue(row, i);
    if (accumulativeTotals.length === 0) {
      accumulativeTotals.push(val);
    } else {
      val += accumulativeTotals[accumulativeTotals.length - 1];
      accumulativeTotals.push(val);
    }
    // calculate accumulative percentage
    if (columnSum !== undefined) {
      accumulativeTotalsPercentage.push(percentReducer(val, columnSum));
    }
  }
  return functionName === AdvFuncList.AccumulativeTotal ? accumulativeTotals : accumulativeTotalsPercentage;
};

const generatePercentAgainstColumn = (
  frame: DataFrame,
  row: Field,
  againstFieldValuesIter: any[],
  calculateChange: boolean
): number[] => {
  let percents: number[] = [];
  for (let i = 0; i < frame.length; i++) {
    const fieldValues = row.values[i];
    const againstFieldValues = againstFieldValuesIter[i];
    let percent = 0;
    const currentValue = fieldValues || 0;
    const divisor = againstFieldValues || 0;
    if (calculateChange) {
      const diff = currentValue - divisor;
      percent = percentReducer(diff, divisor);
    } else {
      percent = percentReducer(currentValue, divisor);
    }
    percent = !isNaN(percent) ? percent : 0;
    percents.push(percent);
  }
  return percents;
};

const generateDeltaFromLast = (frame: DataFrame, row: Field, options: AdvFuncTransformerOptions): number[] => {
  let deltas: number[] = [];
  for (let i = 0; i < frame.length; i++) {
    const currentValue = getFieldValue(row, i);
    const previousRowIndex = i - options.numberOfPrevRows!;
    let previousValue = 0;
    let delta = 0;
    // check if previous row is available
    if (previousRowIndex >= 0 && previousRowIndex < frame.length) {
      previousValue = getFieldValue(row, previousRowIndex);
      delta = currentValue - previousValue;
    }

    if (options.isDeltaFromLastPercentage) {
      deltas.push(percentReducer(delta, previousValue));
    } else {
      deltas.push(delta);
    }
  }
  return deltas;
};

const getValueCreator = (
  options: AdvFuncTransformerOptions,
  allFrames: DataFrame[],
  functionName: string
): ValuesCreator => {
  let matcher = getFieldMatcher({
    id: FieldMatcherID.byName,
    options: options.fieldName,
  });

  let againstMatcher = getFieldMatcher({
    id: FieldMatcherID.byName,
    options: options.againstField,
  });

  return (frame: DataFrame) => {
    // Find the columns that should be examined
    let selectedField: Field<any>;
    const columns: any[] = [];
    const againstColumns: any[] = [];
    for (const field of frame.fields) {
      if (matcher(field, frame, allFrames) && getFieldDisplayName(field, frame, allFrames) === options.fieldName) {
        columns.push(field.values);
        selectedField = field;
      }

      // for percentAgainstColumn and percentChangeAgainstColumn
      if (
        options.functionName === AdvFuncList.PercentageAgainstColumn ||
        options.functionName === AdvFuncList.PercentageChangeAgainstColumn
      ) {
        if (
          againstMatcher(field, frame, allFrames) &&
          getFieldDisplayName(field, frame, allFrames) === options.againstField
        ) {
          againstColumns.push(field.values);
        }
      }
    }

    if (columns.length > 1 || againstColumns.length > 1) {
      throw new Error('Error in applying selected advanced function');
    }

    // Prepare a "fake" field for the row
    const size = frame.length;
    const row: Field = {
      name: 'temp',
      values: new Array(size),
      type: FieldType.number,
      config: {},
    };

    for (let i = 0; i < frame.length; i++) {
      row.values[i] = columns[0][i];
    }

    let vals: number[] = [];
    let divisor;
    const againstIter = new Array(size);

    if (againstColumns.length) {
      for (let i = 0; i < frame.length; i++) {
        againstIter[i] = againstColumns[0][i];
      }
    }

    let results = reduceField({
      field: selectedField!,
      reducers: [ReducerID.sum],
    });

    switch (functionName) {
      case AdvFuncList.AccumulativePercentage:
        vals = generateAccumulations(frame, row, functionName, results[ReducerID.sum]);
        break;
      case AdvFuncList.AccumulativeTotal:
        vals = generateAccumulations(frame, row, functionName);
        break;
      case AdvFuncList.DeltaFromLastN:
        vals = generateDeltaFromLast(frame, row, options);
        break;
      case AdvFuncList.PercentageAgainstColumn:
        vals = generatePercentAgainstColumn(frame, row, againstIter, false);
        break;
      case AdvFuncList.PercentageAgainstInitialValue:
        divisor = row.values[0];
        vals = generateVals(divisor, frame, row);
        break;
      case AdvFuncList.PercentageAgainstMaximumValue:
        divisor = results[ReducerID.max];
        vals = generateVals(divisor, frame, row);
        break;
      case AdvFuncList.PercentageChangeAgainstColumn:
        vals = generatePercentAgainstColumn(frame, row, againstIter, true);
        break;
      case AdvFuncList.PercentageAgainstTotal:
        divisor = results[ReducerID.sum];
        vals = generateVals(divisor, frame, row);
        break;
      case AdvFuncList.TopNRank:
        // divisor = results[ReducerID.sum];
        vals = generateRanks(frame, row);
        break;
    }
    return vals;
  };
};

const generateVals = (divisor: number, frame: DataFrame, row: Field) => {
  let vals = [];
  if (divisor === 0) {
    vals = new Array(frame.length).fill(0);
  } else {
    for (let i = 0; i < frame.length; i++) {
      const val = generatePercentage(row, divisor, i);
      vals.push(val);
    }
  }
  return vals;
};

export function reducedPercentileRow(
  data: DataFrame[],
  matcher: FieldMatcher,
  options: AdvFuncTransformerOptions,
  ctx: DataTransformContext
): DataFrame[] {
  // sort data frame
  const sortedData = sortDataFrames(data, [{ field: options.fieldName }], ctx);

  const processed: DataFrame[] = [];

  for (const series of sortedData) {
    const fields: Field[] = [];
    let rowIndex = -1;
    for (const field of series.fields) {
      if (matcher(field, series, sortedData)) {
        rowIndex = calculatePercentile(field!, options.percentile);
      }
    }

    if (rowIndex > -1) {
      for (const field of series.fields) {
        const copy = {
          ...field,
          values: [field.values.get(rowIndex)],
        };
        fields.push(copy);
      }
      if (fields.length) {
        processed.push({
          ...series,
          fields,
          length: 1, // always one row
        });
      }
    }
  }

  return processed;
}

function calculatePercentile(field: Field, percentile: number): number {
  const rowsCount = field.values.length;
  // Formula for percentile
  const nthPercentileRow = (percentile * (rowsCount + 1)) / 100;
  // Rounding off to get exact row number
  const nthPercentileRowIndex = (nthPercentileRow < 1 ? Math.ceil(nthPercentileRow) : Math.floor(nthPercentileRow)) - 1;
  return nthPercentileRowIndex;
}

const generateRanks = (frame: DataFrame, row: Field) => {
  let prevVal;
  let rank = 0;
  let ranks = [];

  for (let i = 0; i < frame.length; i++) {
    const val = getFieldValue(row, i);
    if (val !== prevVal) {
      ranks.push(++rank);
    } else {
      ranks.push(rank);
    }
    prevVal = val;
  }
  return ranks;
};

const filterDataFrameByRank = (
  data: DataFrame[],
  options: AdvFuncTransformerOptions,
  fieldName: string
): DataFrame[] => {
  const filterOptions: FilterByValueTransformerOptions = {
    filters: [
      {
        fieldName: fieldName,
        config: {
          id: 'lowerOrEqual',
          options: {
            value: options.rank,
          },
        },
      },
    ],
    type: FilterByValueType.include,
    match: FilterByValueMatch.any,
  };

  const filteredFrames = filterDataByValues(data, filterOptions);
  return filteredFrames;
};
