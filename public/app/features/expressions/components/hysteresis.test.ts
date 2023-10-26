import { EvalFunction } from 'app/features/alerting/state/alertDef';

import { ClassicCondition } from '../types';

import { getUnloadEvaluatorTypeFromCondition } from './Threshold';

describe('getUnloadEvaluatorTypeFromCondition', () => {
  it('should return IsBelow when given IsAbove', () => {
    const condition: ClassicCondition = {
      evaluator: {
        type: EvalFunction.IsAbove,
        params: [10],
      },
      query: { params: ['A', 'B'] },
      reducer: { type: 'avg', params: [] },
      type: 'query',
    };

    expect(getUnloadEvaluatorTypeFromCondition(condition)).toBe(EvalFunction.IsBelow);
  });

  it('should return IsAbove when given IsBelow', () => {
    const condition: ClassicCondition = {
      evaluator: {
        type: EvalFunction.IsBelow,
        params: [10],
      },
      query: { params: ['A', 'B'] },
      reducer: { type: 'avg', params: [] },
      type: 'query',
    };

    expect(getUnloadEvaluatorTypeFromCondition(condition)).toBe(EvalFunction.IsAbove);
  });

  it('should return IsOutsideRange when given IsWithinRange', () => {
    const condition: ClassicCondition = {
      evaluator: {
        type: EvalFunction.IsWithinRange,
        params: [10, 20],
      },
      query: { params: ['A', 'B'] },
      reducer: { type: 'avg', params: [] },
      type: 'query',
    };

    expect(getUnloadEvaluatorTypeFromCondition(condition)).toBe(EvalFunction.IsOutsideRange);
  });

  it('should return IsWithinRange when given IsOutsideRange', () => {
    const condition: ClassicCondition = {
      evaluator: {
        type: EvalFunction.IsOutsideRange,
        params: [10, 20],
      },
      query: { params: ['A', 'B'] },
      reducer: { type: 'avg', params: [] },
      type: 'query',
    };

    expect(getUnloadEvaluatorTypeFromCondition(condition)).toBe(EvalFunction.IsWithinRange);
  });
});
