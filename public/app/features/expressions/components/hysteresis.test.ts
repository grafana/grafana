import { EvalFunction } from 'app/features/alerting/state/alertDef';

import { getExpressionIssues } from '../schemas/expressionQuery';
import { type ThresholdCondition, type ThresholdExpressionQuery } from '../schemas/threshold';
import { ExpressionQueryType } from '../types';

import {
  thresholdReducer,
  updateHysteresisChecked,
  updateRefId,
  updateThresholdType,
  updateUnloadParams,
} from './thresholdReducer';

describe('thresholdReducer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  const thresholdCondition: ThresholdCondition = {
    evaluator: { type: EvalFunction.IsAbove, params: [10, 0] },
    unloadEvaluator: {
      type: EvalFunction.IsBelow,
      params: [10, 0],
    },
  };

  it('should return initial state', () => {
    expect(thresholdReducer(undefined, { type: '' })).toEqual({
      type: ExpressionQueryType.threshold,
      conditions: [expect.any(Object)],
      expression: '',
      refId: '',
    });
  });
  it('should update expression with RefId', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      expression: '',
      conditions: [thresholdCondition],
    };

    const newState = thresholdReducer(initialState, updateRefId('B'));

    expect(newState).toMatchSnapshot();
    expect(newState.expression).toEqual('B');
  });
  it('should update Threshold Type, and unloadEvaluator params and type ', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      expression: '',
      conditions: [thresholdCondition],
    };

    const newState = thresholdReducer(initialState, updateThresholdType({ evalFunction: EvalFunction.IsBelow }));

    expect(newState).toMatchSnapshot();
    expect(newState.conditions[0].evaluator.type).toEqual(EvalFunction.IsBelow);
    expect(newState.conditions[0].unloadEvaluator?.type).toEqual(EvalFunction.IsAbove);
    // single → single: preserves the existing param value from thresholdCondition (params[0] = 10)
    expect(newState.conditions[0].unloadEvaluator?.params[0]).toEqual(10);
  });

  it('single → single: preserves existing threshold value', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      expression: '',
      conditions: [
        {
          ...thresholdCondition,
          evaluator: { type: EvalFunction.IsAbove, params: [42] },
          unloadEvaluator: undefined,
        },
      ],
    };

    const newState = thresholdReducer(initialState, updateThresholdType({ evalFunction: EvalFunction.IsBelow }));

    expect(newState.conditions[0].evaluator.type).toEqual(EvalFunction.IsBelow);
    expect(newState.conditions[0].evaluator.params).toEqual([42]);
  });

  it('single → single: normalises stale 2-element params array to 1 element', () => {
    // Older rules may have been saved with params: [10, 0] from a prior range type.
    // Switching between single-value types should collapse it to a single-element array.
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      expression: '',
      conditions: [
        {
          ...thresholdCondition,
          evaluator: { type: EvalFunction.IsAbove, params: [10, 0] },
          unloadEvaluator: undefined,
        },
      ],
    };

    const newState = thresholdReducer(initialState, updateThresholdType({ evalFunction: EvalFunction.IsBelow }));

    expect(newState.conditions[0].evaluator.type).toEqual(EvalFunction.IsBelow);
    expect(newState.conditions[0].evaluator.params).toEqual([10]);
  });

  it('range → single: resets params to [0]', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      expression: '',
      conditions: [
        {
          ...thresholdCondition,
          evaluator: { type: EvalFunction.IsWithinRange, params: [10, 20] },
          unloadEvaluator: undefined,
        },
      ],
    };

    const newState = thresholdReducer(initialState, updateThresholdType({ evalFunction: EvalFunction.IsAbove }));

    expect(newState.conditions[0].evaluator.type).toEqual(EvalFunction.IsAbove);
    expect(newState.conditions[0].evaluator.params).toEqual([0]);
  });

  it('single → range: resets params to [0, 0]', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      expression: '',
      conditions: [
        {
          ...thresholdCondition,
          evaluator: { type: EvalFunction.IsAbove, params: [42] },
          unloadEvaluator: undefined,
        },
      ],
    };

    const newState = thresholdReducer(initialState, updateThresholdType({ evalFunction: EvalFunction.IsWithinRange }));

    expect(newState.conditions[0].evaluator.type).toEqual(EvalFunction.IsWithinRange);
    expect(newState.conditions[0].evaluator.params).toEqual([0, 0]);
  });

  it('range → range: preserves existing params', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      expression: '',
      conditions: [
        {
          ...thresholdCondition,
          evaluator: { type: EvalFunction.IsWithinRange, params: [10, 20] },
          unloadEvaluator: undefined,
        },
      ],
    };

    const newState = thresholdReducer(initialState, updateThresholdType({ evalFunction: EvalFunction.IsOutsideRange }));

    expect(newState.conditions[0].evaluator.type).toEqual(EvalFunction.IsOutsideRange);
    expect(newState.conditions[0].evaluator.params).toEqual([10, 20]);
  });
  it('Should update unlooadEvaluator when checking hysteresis', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      expression: '',
      conditions: [thresholdCondition],
    };

    const newState = thresholdReducer(initialState, updateHysteresisChecked({ hysteresisChecked: true }));

    expect(newState).toMatchSnapshot();
    expect(newState.conditions[0].unloadEvaluator?.type).toEqual(EvalFunction.IsBelow);
    expect(newState.conditions[0].unloadEvaluator?.params[0]).toEqual(10);
  });
  it('sets the unloadEvaluator type to IsEqual when checking hysteresis on an "is equal to" threshold', () => {
    // Equality has no directional opposite: the alert should recover when the value
    // equals the recovery value, so the unload evaluator must stay IsEqual (not IsNotEqual).
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      expression: '',
      conditions: [
        {
          ...thresholdCondition,
          evaluator: { type: EvalFunction.IsEqual, params: [20] },
          unloadEvaluator: undefined,
        },
      ],
    };

    const newState = thresholdReducer(initialState, updateHysteresisChecked({ hysteresisChecked: true }));

    expect(newState.conditions[0].unloadEvaluator?.type).toEqual(EvalFunction.IsEqual);
  });

  // The default recovery value copies the threshold, which "is equal to" cannot use - the rule
  // would flap between firing and normal on every evaluation. The reducer still sets it up that
  // way; the save rules are what refuse it.
  it('produces a recovery value the save rules reject, for an "is equal to" threshold', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      expression: '',
      conditions: [
        {
          ...thresholdCondition,
          evaluator: { type: EvalFunction.IsEqual, params: [20] },
          unloadEvaluator: undefined,
        },
      ],
    };

    const newState = thresholdReducer(initialState, updateHysteresisChecked({ hysteresisChecked: true }));

    expect(getExpressionIssues(newState)).toContainEqual(
      expect.objectContaining({ id: 'threshold.recovery.different', limit: 20 })
    );
  });

  it('sets the unloadEvaluator type to IsEqual when switching the threshold type to "is equal to" with hysteresis on', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      expression: '',
      conditions: [thresholdCondition],
    };

    const newState = thresholdReducer(initialState, updateThresholdType({ evalFunction: EvalFunction.IsEqual }));

    expect(newState.conditions[0].evaluator.type).toEqual(EvalFunction.IsEqual);
    expect(newState.conditions[0].unloadEvaluator?.type).toEqual(EvalFunction.IsEqual);
  });

  it('reports a validation error when switching to an "is equal to" threshold with hysteresis on', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      expression: '',
      conditions: [thresholdCondition],
    };

    const newState = thresholdReducer(initialState, updateThresholdType({ evalFunction: EvalFunction.IsEqual }));

    expect(getExpressionIssues(newState)).toContainEqual(
      expect.objectContaining({ id: 'threshold.recovery.different', limit: 10 })
    );
  });

  it('sets the unloadEvaluator type to IsEqual when checking hysteresis on an "is not equal to" threshold', () => {
    // "is not equal to X" recovers when the value returns to X, so the unload evaluator is IsEqual.
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      expression: '',
      conditions: [
        {
          ...thresholdCondition,
          evaluator: { type: EvalFunction.IsNotEqual, params: [20] },
          unloadEvaluator: undefined,
        },
      ],
    };

    const newState = thresholdReducer(initialState, updateHysteresisChecked({ hysteresisChecked: true }));

    expect(newState.conditions[0].unloadEvaluator?.type).toEqual(EvalFunction.IsEqual);
  });

  it('Should update unlooadEvaluator when unchecking hysteresis', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      expression: '',
      conditions: [thresholdCondition],
    };

    const newState = thresholdReducer(initialState, updateHysteresisChecked({ hysteresisChecked: false }));

    expect(newState).toMatchSnapshot();
    expect(newState.conditions[0].unloadEvaluator).toEqual(undefined);
  });

  it('should update unloadParams with no error when are valid', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      expression: '',
      conditions: [thresholdCondition],
    };

    const newState = thresholdReducer(initialState, updateUnloadParams({ param: 9, index: 0 }));

    expect(newState).toMatchSnapshot();
    expect(newState.conditions[0].unloadEvaluator?.params[0]).toEqual(9);
  });
  it('should update unloadParams no error when are invalid', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      expression: '',
      conditions: [thresholdCondition],
    };

    const newState = thresholdReducer(initialState, updateUnloadParams({ param: 20, index: 0 }));

    expect(newState).toMatchSnapshot();
    expect(newState.conditions[0].unloadEvaluator?.params[0]).toEqual(20);
    // 20 is above the threshold of 10, so it would never recover.
    expect(getExpressionIssues(newState)).toContainEqual(
      expect.objectContaining({ id: 'threshold.recovery.at-most', limit: 10 })
    );
  });
});
