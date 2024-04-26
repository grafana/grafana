import { EvalFunction } from 'app/features/alerting/state/alertDef';

import { ClassicCondition, ExpressionQueryType, ThresholdExpressionQuery } from '../types';

import {
  isInvalid,
  thresholdReducer,
  updateHysteresisChecked,
  updateRefId,
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
    expect(thresholdReducer(undefined, { type: undefined })).toEqual({
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
    expect(newState.conditions[0].unloadEvaluator?.params[0]).toEqual(10);
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
});
