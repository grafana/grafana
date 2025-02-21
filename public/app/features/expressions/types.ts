import { DataQuery, ReducerID, SelectableValue } from '@grafana/data';
import { config } from 'app/core/config';

import { EvalFunction } from '../alerting/state/alertDef';

/**
 * MATCHES a constant in DataSourceWithBackend
 */
export const ExpressionDatasourceUID = '__expr__';

export enum ExpressionQueryType {
  math = 'math',
  reduce = 'reduce',
  resample = 'resample',
  classic = 'classic_conditions',
  threshold = 'threshold',
  sql = 'sql',
}

export const getExpressionLabel = (type: ExpressionQueryType) => {
  switch (type) {
    case ExpressionQueryType.math:
      return 'Math';
    case ExpressionQueryType.reduce:
      return 'Reduce';
    case ExpressionQueryType.resample:
      return 'Resample';
    case ExpressionQueryType.classic:
      return 'Classic condition (legacy)';
    case ExpressionQueryType.threshold:
      return 'Threshold';
    case ExpressionQueryType.sql:
      return 'SQL';
  }
};

export const expressionTypes: Array<SelectableValue<ExpressionQueryType>> = [
  {
    value: ExpressionQueryType.math,
    label: 'Math',
    description: 'Free-form math formulas on time series or number data.',
  },
  {
    value: ExpressionQueryType.reduce,
    label: 'Reduce',
    description:
      'Takes one or more time series returned from a query or an expression and turns each series into a single number.',
  },
  {
    value: ExpressionQueryType.resample,
    label: 'Resample',
    description: 'Changes the time stamps in each time series to have a consistent time interval.',
  },
  {
    value: ExpressionQueryType.classic,
    label: 'Classic condition (legacy)',
    description:
      'Takes one or more time series returned from a query or an expression and checks if any of the series match the condition. Disables multi-dimensional alerts for this rule.',
  },
  {
    value: ExpressionQueryType.threshold,
    label: 'Threshold',
    description:
      'Takes one or more time series returned from a query or an expression and checks if any of the series match the threshold condition.',
  },
  {
    value: ExpressionQueryType.sql,
    label: 'SQL',
    description: 'Transform data using SQL. Supports Aggregate/Analytics functions from DuckDB',
  },
].filter((expr) => {
  if (expr.value === ExpressionQueryType.sql) {
    return config.featureToggles?.sqlExpressions;
  }
  return true;
});

export const reducerTypes: Array<SelectableValue<string>> = [
  { value: ReducerID.min, label: 'Min', description: 'Get the minimum value' },
  { value: ReducerID.max, label: 'Max', description: 'Get the maximum value' },
  { value: ReducerID.mean, label: 'Mean', description: 'Get the average value' },
  { value: ReducerID.median, label: 'Median', description: 'Get the median value' },
  { value: ReducerID.sum, label: 'Sum', description: 'Get the sum of all values' },
  { value: ReducerID.count, label: 'Count', description: 'Get the number of values' },
  { value: ReducerID.last, label: 'Last', description: 'Get the last value' },
];

export enum ReducerMode {
  Strict = '', // backend API wants an empty string to support "strict" mode
  ReplaceNonNumbers = 'replaceNN',
  DropNonNumbers = 'dropNN',
}

export const reducerModes: Array<SelectableValue<ReducerMode>> = [
  {
    value: ReducerMode.Strict,
    label: 'Strict',
    description: 'Result can be NaN if series contains non-numeric data',
  },
  {
    value: ReducerMode.DropNonNumbers,
    label: 'Drop Non-numeric Values',
    description: 'Drop NaN, +/-Inf and null from input series before reducing',
  },
  {
    value: ReducerMode.ReplaceNonNumbers,
    label: 'Replace Non-numeric Values',
    description: 'Replace NaN, +/-Inf and null with a constant value before reducing',
  },
];

export const downsamplingTypes: Array<SelectableValue<string>> = [
  { value: ReducerID.last, label: 'Last', description: 'Fill with the last value' },
  { value: ReducerID.min, label: 'Min', description: 'Fill with the minimum value' },
  { value: ReducerID.max, label: 'Max', description: 'Fill with the maximum value' },
  { value: ReducerID.mean, label: 'Mean', description: 'Fill with the average value' },
  { value: ReducerID.sum, label: 'Sum', description: 'Fill with the sum of all values' },
];

export const upsamplingTypes: Array<SelectableValue<string>> = [
  { value: 'pad', label: 'pad', description: 'fill with the last known value' },
  { value: 'backfilling', label: 'backfilling', description: 'fill with the next known value' },
  { value: 'fillna', label: 'fillna', description: 'Fill with NaNs' },
];

export const thresholdFunctions: Array<SelectableValue<EvalFunction>> = [
  { value: EvalFunction.IsAbove, label: 'Is above' },
  { value: EvalFunction.IsBelow, label: 'Is below' },
  { value: EvalFunction.IsEqual, label: 'Is equal to' },
  { value: EvalFunction.IsNotEqual, label: 'Is not equal to' },
  { value: EvalFunction.IsGreaterThanEqual, label: 'Is above or equal to' },
  { value: EvalFunction.IsLessThanEqual, label: 'Is below or equal to' },
  { value: EvalFunction.IsWithinRange, label: 'Is within range' },
  { value: EvalFunction.IsOutsideRange, label: 'Is outside range' },
  { value: EvalFunction.IsWithinRangeIncluded, label: 'Is within range included' },
  { value: EvalFunction.IsOutsideRangeIncluded, label: 'Is outside range included' },
];

/**
 * For now this is a single object to cover all the types.... would likely
 * want to split this up by type as the complexity increases
 */
export interface ExpressionQuery extends DataQuery {
  type: ExpressionQueryType;
  reducer?: string;
  expression?: string;
  window?: string;
  downsampler?: string;
  upsampler?: string;
  conditions?: ClassicCondition[];
  settings?: ExpressionQuerySettings;
}

export interface ThresholdExpressionQuery extends ExpressionQuery {
  conditions: ClassicCondition[];
}
export interface ExpressionQuerySettings {
  mode?: ReducerMode;
  replaceWithValue?: number;
}

export interface ClassicCondition {
  evaluator: {
    params: number[];
    type: EvalFunction;
  };
  unloadEvaluator?: {
    params: number[];
    type: EvalFunction;
  };
  operator?: {
    type: string;
  };
  query: {
    params: string[];
  };
  reducer: {
    params: [];
    type: ReducerType;
  };
  type: 'query';
}

export type ReducerType =
  | 'avg'
  | 'min'
  | 'max'
  | 'sum'
  | 'count'
  | 'last'
  | 'median'
  | 'diff'
  | 'diff_abs'
  | 'percent_diff'
  | 'percent_diff_abs'
  | 'count_non_null';
