import { EvalFunction } from 'app/features/alerting/state/alertDef';

import { type ClassicCondition, ExpressionQueryType, type ThresholdExpressionQuery } from '../types';

import {
  isInvalid,
  normalizeUnloadEvaluator,
  thresholdReducer,
  updateHysteresisChecked,
  updateRefId,
  updateThresholdParams,
  updateThresholdType,
  updateUnloadParams,
} from './thresholdReducer';

describe('isInvalid', () => {
  it('returns an error message if unloadEvaluator.params[0] is undefined', () => {
    const condition: ClassicCondition = {
      unloadEvaluator: {
        type: EvalFunction.IsAbove,
        params: [],
      },
      evaluator: { type: EvalFunction.IsAbove, params: [10] },
      query: { params: ['A', 'B'] },
      reducer: { type: 'avg', params: [] },
      type: 'query',
    };
    expect(isInvalid(condition)).toEqual({ errorMsg: 'This value cannot be empty' });
  });

  it('When using is above, returns an error message if the value in unloadevaluator is above the threshold', () => {
    const condition: ClassicCondition = {
      unloadEvaluator: {
        type: EvalFunction.IsAbove,
        params: [15],
      },
      evaluator: { type: EvalFunction.IsAbove, params: [10] },
      query: { params: ['A', 'B'] },
      reducer: { type: 'avg', params: [] },
      type: 'query',
    };
    expect(isInvalid(condition)).toEqual({ errorMsg: 'Enter a number less than or equal to 10' });
  });

  it('When using is below, returns an error message if the value in unloadevaluator is below the threshold', () => {
    const condition: ClassicCondition = {
      unloadEvaluator: {
        type: EvalFunction.IsAbove,
        params: [9],
      },
      evaluator: { type: EvalFunction.IsBelow, params: [10] },
      query: { params: ['A', 'B'] },
      reducer: { type: 'avg', params: [] },
      type: 'query',
    };
    expect(isInvalid(condition)).toEqual({ errorMsg: 'Enter a number more than or equal to 10' });
  });

  it('When using is within range, returns an error message if the value in unloadevaluator is within the range', () => {
    // first parameter is wrong
    const condition: ClassicCondition = {
      unloadEvaluator: {
        type: EvalFunction.IsOutsideRange,
        params: [11, 21],
      },
      evaluator: { type: EvalFunction.IsWithinRange, params: [10, 20] },
      query: { params: ['A', 'B'] },
      reducer: { type: 'avg', params: [] },
      type: 'query',
    };
    expect(isInvalid(condition)).toEqual({ errorMsgFrom: 'Enter a number less than or equal to 10' });
    // second parameter is wrong
    const condition2: ClassicCondition = {
      unloadEvaluator: {
        type: EvalFunction.IsOutsideRange,
        params: [9, 19],
      },
      evaluator: { type: EvalFunction.IsWithinRange, params: [10, 20] },
      query: { params: ['A', 'B'] },
      reducer: { type: 'avg', params: [] },
      type: 'query',
    };
    expect(isInvalid(condition2)).toEqual({ errorMsgTo: 'Enter a number be more than or equal to 20' });
  });
  it('When using is outside range, returns an error message if the value in unloadevaluator is outside the range', () => {
    // first parameter is wrong
    const condition: ClassicCondition = {
      unloadEvaluator: {
        type: EvalFunction.IsWithinRange,
        params: [8, 19],
      },
      evaluator: { type: EvalFunction.IsOutsideRange, params: [10, 20] },
      query: { params: ['A', 'B'] },
      reducer: { type: 'avg', params: [] },
      type: 'query',
    };
    expect(isInvalid(condition)).toEqual({ errorMsgFrom: 'Enter a number more than or equal to 10' });
    // second parameter is wrong
    const condition2: ClassicCondition = {
      unloadEvaluator: {
        type: EvalFunction.IsWithinRange,
        params: [11, 21],
      },
      evaluator: { type: EvalFunction.IsOutsideRange, params: [10, 20] },
      query: { params: ['A', 'B'] },
      reducer: { type: 'avg', params: [] },
      type: 'query',
    };
    expect(isInvalid(condition2)).toEqual({ errorMsgTo: 'Enter a number less than or equal to 20' });
  });
});

describe('thresholdReducer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  const onError = jest.fn();
  const thresholdCondition: ClassicCondition = {
    evaluator: { type: EvalFunction.IsAbove, params: [10, 0] },
    unloadEvaluator: {
      type: EvalFunction.IsBelow,
      params: [10, 0],
    },
    query: { params: ['A', 'B'] },
    reducer: { type: 'avg', params: [] },
    type: 'query',
  };

  it('should return initial state', () => {
    expect(thresholdReducer(undefined, { type: '' })).toEqual({
      type: ExpressionQueryType.threshold,
      conditions: [],
      refId: '',
    });
  });
  it('should update expression with RefId', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
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
      conditions: [thresholdCondition],
    };

    const newState = thresholdReducer(
      initialState,
      updateThresholdType({ evalFunction: EvalFunction.IsBelow, onError })
    );

    expect(newState).toMatchSnapshot();
    expect(newState.conditions[0].evaluator.type).toEqual(EvalFunction.IsBelow);
    expect(newState.conditions[0].unloadEvaluator?.type).toEqual(EvalFunction.IsAbove);
    expect(onError).toHaveBeenCalledWith(undefined);
    // single → single: preserves the existing param value from thresholdCondition (params[0] = 10)
    expect(newState.conditions[0].unloadEvaluator?.params[0]).toEqual(10);
  });

  it('single → single: preserves existing threshold value', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      conditions: [
        {
          ...thresholdCondition,
          evaluator: { type: EvalFunction.IsAbove, params: [42] },
          unloadEvaluator: undefined,
        },
      ],
    };

    const newState = thresholdReducer(
      initialState,
      updateThresholdType({ evalFunction: EvalFunction.IsBelow, onError })
    );

    expect(newState.conditions[0].evaluator.type).toEqual(EvalFunction.IsBelow);
    expect(newState.conditions[0].evaluator.params).toEqual([42]);
  });

  it('single → single: normalises stale 2-element params array to 1 element', () => {
    // Older rules may have been saved with params: [10, 0] from a prior range type.
    // Switching between single-value types should collapse it to a single-element array.
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      conditions: [
        {
          ...thresholdCondition,
          evaluator: { type: EvalFunction.IsAbove, params: [10, 0] },
          unloadEvaluator: undefined,
        },
      ],
    };

    const newState = thresholdReducer(
      initialState,
      updateThresholdType({ evalFunction: EvalFunction.IsBelow, onError })
    );

    expect(newState.conditions[0].evaluator.type).toEqual(EvalFunction.IsBelow);
    expect(newState.conditions[0].evaluator.params).toEqual([10]);
  });

  it('range → single: resets params to [0]', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      conditions: [
        {
          ...thresholdCondition,
          evaluator: { type: EvalFunction.IsWithinRange, params: [10, 20] },
          unloadEvaluator: undefined,
        },
      ],
    };

    const newState = thresholdReducer(
      initialState,
      updateThresholdType({ evalFunction: EvalFunction.IsAbove, onError })
    );

    expect(newState.conditions[0].evaluator.type).toEqual(EvalFunction.IsAbove);
    expect(newState.conditions[0].evaluator.params).toEqual([0]);
  });

  it('single → range: resets params to [0, 0]', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      conditions: [
        {
          ...thresholdCondition,
          evaluator: { type: EvalFunction.IsAbove, params: [42] },
          unloadEvaluator: undefined,
        },
      ],
    };

    const newState = thresholdReducer(
      initialState,
      updateThresholdType({ evalFunction: EvalFunction.IsWithinRange, onError })
    );

    expect(newState.conditions[0].evaluator.type).toEqual(EvalFunction.IsWithinRange);
    expect(newState.conditions[0].evaluator.params).toEqual([0, 0]);
  });

  it('range → range: preserves existing params', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      conditions: [
        {
          ...thresholdCondition,
          evaluator: { type: EvalFunction.IsWithinRange, params: [10, 20] },
          unloadEvaluator: undefined,
        },
      ],
    };

    const newState = thresholdReducer(
      initialState,
      updateThresholdType({ evalFunction: EvalFunction.IsOutsideRange, onError })
    );

    expect(newState.conditions[0].evaluator.type).toEqual(EvalFunction.IsOutsideRange);
    expect(newState.conditions[0].evaluator.params).toEqual([10, 20]);
  });
  it('Should update unlooadEvaluator when checking hysteresis', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      conditions: [thresholdCondition],
    };

    const newState = thresholdReducer(initialState, updateHysteresisChecked({ hysteresisChecked: true, onError }));

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
      conditions: [
        {
          ...thresholdCondition,
          evaluator: { type: EvalFunction.IsEqual, params: [20] },
          unloadEvaluator: undefined,
        },
      ],
    };

    const newState = thresholdReducer(initialState, updateHysteresisChecked({ hysteresisChecked: true, onError }));

    expect(newState.conditions[0].unloadEvaluator?.type).toEqual(EvalFunction.IsEqual);
  });

  it('reports a validation error when checking hysteresis on an "is equal to" threshold', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      conditions: [
        {
          ...thresholdCondition,
          evaluator: { type: EvalFunction.IsEqual, params: [20] },
          unloadEvaluator: undefined,
        },
      ],
    };

    thresholdReducer(initialState, updateHysteresisChecked({ hysteresisChecked: true, onError }));

    expect(onError).toHaveBeenCalledWith('Enter a different number than 20');
  });

  it('sets the unloadEvaluator type to IsEqual when switching the threshold type to "is equal to" with hysteresis on', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      conditions: [thresholdCondition],
    };

    const newState = thresholdReducer(
      initialState,
      updateThresholdType({ evalFunction: EvalFunction.IsEqual, onError })
    );

    expect(newState.conditions[0].evaluator.type).toEqual(EvalFunction.IsEqual);
    expect(newState.conditions[0].unloadEvaluator?.type).toEqual(EvalFunction.IsEqual);
  });

  it('reports a validation error when switching to an "is equal to" threshold with hysteresis on', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      conditions: [thresholdCondition],
    };

    thresholdReducer(initialState, updateThresholdType({ evalFunction: EvalFunction.IsEqual, onError }));

    expect(onError).toHaveBeenCalledWith('Enter a different number than 10');
  });

  it('sets the unloadEvaluator type to IsEqual when checking hysteresis on an "is not equal to" threshold', () => {
    // "is not equal to X" recovers when the value returns to X, so the unload evaluator is IsEqual.
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      conditions: [
        {
          ...thresholdCondition,
          evaluator: { type: EvalFunction.IsNotEqual, params: [20] },
          unloadEvaluator: undefined,
        },
      ],
    };

    const newState = thresholdReducer(initialState, updateHysteresisChecked({ hysteresisChecked: true, onError }));

    expect(newState.conditions[0].unloadEvaluator?.type).toEqual(EvalFunction.IsEqual);
  });

  it('Should update unlooadEvaluator when unchecking hysteresis', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      conditions: [thresholdCondition],
    };

    const newState = thresholdReducer(initialState, updateHysteresisChecked({ hysteresisChecked: false, onError }));

    expect(newState).toMatchSnapshot();
    expect(newState.conditions[0].unloadEvaluator).toEqual(undefined);
    expect(onError).toHaveBeenCalledWith(undefined);
  });

  it('should update unloadParams with no error when are valid', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      conditions: [thresholdCondition],
    };

    const newState = thresholdReducer(initialState, updateUnloadParams({ param: 9, index: 0, onError }));

    expect(newState).toMatchSnapshot();
    expect(newState.conditions[0].unloadEvaluator?.params[0]).toEqual(9);
    expect(onError).toHaveBeenCalledWith(undefined);
  });
  it('should update unloadParams no error when are invalid', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      conditions: [thresholdCondition],
    };

    const newState = thresholdReducer(initialState, updateUnloadParams({ param: 20, index: 0, onError }));

    expect(newState).toMatchSnapshot();
    expect(newState.conditions[0].unloadEvaluator?.params[0]).toEqual(20);
    expect(onError).toHaveBeenCalledWith('Enter a number less than or equal to 10');
  });

  it('clears the error when the main threshold changes and makes the recovery threshold valid', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      conditions: [
        {
          ...thresholdCondition,
          evaluator: { type: EvalFunction.IsEqual, params: [20] },
          unloadEvaluator: { type: EvalFunction.IsEqual, params: [20] },
        },
      ],
    };

    thresholdReducer(initialState, updateThresholdParams({ param: 21, index: 0, onError }));

    expect(onError).toHaveBeenCalledWith(undefined);
  });

  it('reports an error when the main threshold changes and makes the recovery threshold invalid', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      conditions: [
        {
          ...thresholdCondition,
          evaluator: { type: EvalFunction.IsAbove, params: [100] },
          unloadEvaluator: { type: EvalFunction.IsBelow, params: [90] },
        },
      ],
    };

    thresholdReducer(initialState, updateThresholdParams({ param: 80, index: 0, onError }));

    expect(onError).toHaveBeenCalledWith('Enter a number less than or equal to 80');
  });

  it('does not report an error when the main threshold changes and there is no recovery threshold', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      conditions: [
        {
          ...thresholdCondition,
          evaluator: { type: EvalFunction.IsAbove, params: [100] },
          unloadEvaluator: undefined,
        },
      ],
    };

    thresholdReducer(initialState, updateThresholdParams({ param: 80, index: 0, onError }));

    expect(onError).not.toHaveBeenCalled();
  });

  it('keeps the recovery value when the main threshold changes after enabling hysteresis', () => {
    const initialState: ThresholdExpressionQuery = {
      type: ExpressionQueryType.threshold,
      refId: 'A',
      conditions: [
        {
          ...thresholdCondition,
          evaluator: { type: EvalFunction.IsAbove, params: [100] },
          unloadEvaluator: undefined,
        },
      ],
    };

    const withHysteresis = thresholdReducer(
      initialState,
      updateHysteresisChecked({ hysteresisChecked: true, onError })
    );
    const withNewThreshold = thresholdReducer(withHysteresis, updateThresholdParams({ param: 200, index: 0, onError }));

    expect(withNewThreshold.conditions[0].unloadEvaluator?.params[0]).toEqual(100);
  });
});

describe('normalizeUnloadEvaluator', () => {
  const condition: ClassicCondition = {
    evaluator: { type: EvalFunction.IsEqual, params: [20] },
    query: { params: ['A'] },
    reducer: { type: 'last', params: [] },
    type: 'query',
  };

  it('rewrites a legacy not-equal recovery evaluator on an equal threshold, keeping its value', () => {
    const normalized = normalizeUnloadEvaluator({
      ...condition,
      unloadEvaluator: { type: EvalFunction.IsNotEqual, params: [1] },
    });

    expect(normalized.unloadEvaluator).toEqual({ type: EvalFunction.IsEqual, params: [1] });
  });

  it('leaves a recovery evaluator that already matches the threshold type untouched', () => {
    const alreadyNormalized: ClassicCondition = {
      ...condition,
      unloadEvaluator: { type: EvalFunction.IsEqual, params: [1] },
    };

    expect(normalizeUnloadEvaluator(alreadyNormalized)).toBe(alreadyNormalized);
  });

  it('leaves a condition without a recovery evaluator untouched', () => {
    expect(normalizeUnloadEvaluator(condition)).toBe(condition);
  });

  it('leaves the recovery evaluator untouched for threshold types that have no recovery type', () => {
    const noValueCondition: ClassicCondition = {
      ...condition,
      evaluator: { type: EvalFunction.HasNoValue, params: [] },
      unloadEvaluator: { type: EvalFunction.IsNotEqual, params: [1] },
    };

    expect(normalizeUnloadEvaluator(noValueCondition)).toBe(noValueCondition);
  });
});
