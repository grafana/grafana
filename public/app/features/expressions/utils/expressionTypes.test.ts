import { EvalFunction } from 'app/features/alerting/state/alertDef';

import { makeExpression, makeReduceExpression } from '../schemas/factories';
import { ExpressionQueryType, ReducerMode } from '../types';

import { getReducerType, isRangeEvaluator, isReducerExpression, isStrictReducer } from './expressionTypes';

describe('getReducerType', () => {
  it('accepts a classic condition reducer', () => {
    expect(getReducerType('percent_diff_abs')).toBe('percent_diff_abs');
  });

  it('returns undefined for something that is not a reducer', () => {
    expect(getReducerType('not-a-reducer')).toBeUndefined();
  });
});

describe('isStrictReducer', () => {
  const reduce = makeReduceExpression({ refId: 'B' });

  it('treats a reduce with no settings as strict, which is what the backend does', () => {
    expect(isStrictReducer(reduce)).toBe(true);
  });

  it('treats an empty mode as strict, because that is how the backend spells it', () => {
    expect(isStrictReducer({ ...reduce, settings: { mode: ReducerMode.Strict } })).toBe(true);
  });

  it('is not strict when non-numeric values are dropped', () => {
    expect(isStrictReducer({ ...reduce, settings: { mode: ReducerMode.DropNonNumbers } })).toBe(false);
  });

  it('is not strict for an expression that is not a reduce', () => {
    expect(isStrictReducer(makeExpression(ExpressionQueryType.threshold, { refId: 'C' }))).toBe(false);
  });
});

describe('isReducerExpression', () => {
  it('narrows a reduce expression', () => {
    expect(isReducerExpression(makeExpression(ExpressionQueryType.reduce, { refId: 'B' }))).toBe(true);
  });

  it('rejects the other types', () => {
    expect(isReducerExpression(makeExpression(ExpressionQueryType.math, { refId: 'B' }))).toBe(false);
  });
});

describe('isRangeEvaluator', () => {
  it.each([
    EvalFunction.IsWithinRange,
    EvalFunction.IsOutsideRange,
    EvalFunction.IsWithinRangeIncluded,
    EvalFunction.IsOutsideRangeIncluded,
  ])('treats %s as a range, so it needs two values', (fn) => {
    expect(isRangeEvaluator(fn)).toBe(true);
  });

  it.each([EvalFunction.IsAbove, EvalFunction.IsBelow, EvalFunction.IsEqual])('treats %s as a single value', (fn) => {
    expect(isRangeEvaluator(fn)).toBe(false);
  });
});
