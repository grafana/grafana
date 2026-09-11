import { EvalFunction } from '../../alerting/state/alertDef';
import { isReducerType } from '../guards';
import type { ReduceExpressionQuery } from '../schemas/reduce';
import type { ThresholdExpressionQuery } from '../schemas/threshold';
import { type ExpressionQuery, ExpressionQueryType, ReducerMode, type ReducerType } from '../types';

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

export function isReducerExpression(expressionModel: ExpressionQuery): expressionModel is ReduceExpressionQuery {
  return expressionModel.type === ExpressionQueryType.reduce;
}

export function isThresholdExpression(expressionModel: ExpressionQuery): expressionModel is ThresholdExpressionQuery {
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
