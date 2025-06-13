import { ReducerID } from '@grafana/data';

import { EvalFunction } from '../../alerting/state/alertDef';
import { isReducerType } from '../guards';
import { ClassicCondition, ExpressionQuery, ExpressionQueryType, ReducerMode, ReducerType } from '../types';

export const getDefaults = (query: ExpressionQuery) => {
  switch (query.type) {
    case ExpressionQueryType.reduce:
      if (!query.reducer) {
        query.reducer = ReducerID.mean;
      }

      break;

    case ExpressionQueryType.resample:
      if (!query.downsampler) {
        query.downsampler = ReducerID.mean;
      }

      if (!query.upsampler) {
        query.upsampler = 'fillna';
      }

      query.reducer = undefined;
      break;

    case ExpressionQueryType.math:
      query.expression = undefined;
      break;

    case ExpressionQueryType.classic:
      if (!query.conditions) {
        query.conditions = [defaultCondition];
      }

      break;

    default:
      query.reducer = undefined;
  }

  return query;
};

export const defaultCondition: ClassicCondition = {
  type: 'query',
  reducer: {
    params: [],
    type: 'avg',
  },
  operator: {
    type: 'and',
  },
  query: { params: [] },
  evaluator: {
    params: [0, 0],
    type: EvalFunction.IsAbove,
  },
};

/**
 * Returns the ReducerType if the value is a valid ReducerType, otherwise undefined
 * @param value string
 */
export function getReducerType(value: string): ReducerType | undefined {
  if (isReducerType(value)) {
    return value;
  }
  return undefined;
}

export function isStrictReducer(expressionModel: ExpressionQuery): boolean {
  if (!isReducerExpression(expressionModel)) {
    return false;
  }

  const mode = expressionModel.settings?.mode;
  return mode === ReducerMode.Strict || mode === undefined;
}

export function isReducerExpression(expressionModel: ExpressionQuery) {
  return expressionModel.type === ExpressionQueryType.reduce;
}

export function isThresholdExpression(expressionModel: ExpressionQuery) {
  return expressionModel.type === ExpressionQueryType.threshold;
}

/**
 * Determines if the given evaluator function type is a range type (requiring two threshold values)
 */
export function isRangeEvaluator(evalFunction: EvalFunction): boolean {
  return (
    evalFunction === EvalFunction.IsWithinRange ||
    evalFunction === EvalFunction.IsOutsideRange ||
    evalFunction === EvalFunction.IsOutsideRangeIncluded ||
    evalFunction === EvalFunction.IsWithinRangeIncluded
  );
}
