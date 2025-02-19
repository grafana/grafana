import { createAction, createReducer } from '@reduxjs/toolkit';

import { EvalFunction } from 'app/features/alerting/state/alertDef';

import { ClassicCondition, ExpressionQueryType, ThresholdExpressionQuery } from '../types';

export const updateRefId = createAction<string | undefined>('thresold/updateRefId');
export const updateThresholdType = createAction<{
  evalFunction: EvalFunction;
  onError: ((error: string | undefined) => void) | undefined;
}>('thresold/updateThresholdType');
export const updateThresholdParams = createAction<{ param: number; index: number }>('thresold/updateThresholdParams');
export const updateHysteresisChecked = createAction<{
  hysteresisChecked: boolean;
  onError: ((error: string | undefined) => void) | undefined;
}>('thresold/updateHysteresis');
export const updateUnloadParams = createAction<{
  param: number;
  index: number;
  onError: ((error: string | undefined) => void) | undefined;
}>('thresold/updateUnloadParams');

export const thresholdReducer = createReducer<ThresholdExpressionQuery>(
  { type: ExpressionQueryType.threshold, refId: '', conditions: [] },
  (builder) => {
    builder.addCase(updateRefId, (state, action) => {
      state.expression = action.payload;
    });
    builder.addCase(updateThresholdType, (state, action) => {
      const typeInPayload = action.payload.evalFunction;
      const onError = action.payload.onError;

      //set new type in evaluator
      state.conditions[0].evaluator.type = typeInPayload;

      // check if hysteresis is checked
      const hsyteresisIsChecked = Boolean(state.conditions[0].unloadEvaluator);

      if (hsyteresisIsChecked) {
        // when type whas changed and hsyteresIsChecked, we need to update the type for the unload evaluator with the opposite type
        const updatedUnloadType = getUnloadEvaluatorTypeFromEvaluatorType(state.conditions[0].evaluator.type);

        // set error to undefined when type is changed as we default to the new type that is valid
        if (onError) {
          onError(undefined); //clear error
        }
        // set newtype in evaluator
        state.conditions[0].evaluator.type = typeInPayload;
        // set new type and params in unload evaluator
        const defaultUnloadEvaluator = {
          type: updatedUnloadType,
          params: state.conditions[0].evaluator?.params ?? [0, 0],
        };
        state.conditions[0].unloadEvaluator = defaultUnloadEvaluator;
      }
    });
    builder.addCase(updateThresholdParams, (state, action) => {
      const { param, index } = action.payload;
      state.conditions[0].evaluator.params[index] = param;
    });
    builder.addCase(updateHysteresisChecked, (state, action) => {
      const { hysteresisChecked, onError } = action.payload;
      if (!hysteresisChecked) {
        state.conditions[0].unloadEvaluator = undefined;
        if (onError) {
          onError(undefined); // clear error
        }
      } else {
        state.conditions[0].unloadEvaluator = {
          type: getUnloadEvaluatorTypeFromEvaluatorType(state.conditions[0].evaluator.type),
          params: state.conditions[0].evaluator?.params ?? [0, 0],
        };
      }
    });
    builder.addCase(updateUnloadParams, (state, action) => {
      const { param, index, onError } = action.payload;
      // if there is no unload evaluator, we use the default evaluator params
      if (!state.conditions[0].unloadEvaluator) {
        state.conditions[0].unloadEvaluator = {
          type: getUnloadEvaluatorTypeFromEvaluatorType(state.conditions[0].evaluator.type),
          params: state.conditions[0].evaluator?.params ?? [0, 0],
        };
      } else {
        // only update the param
        state.conditions[0].unloadEvaluator!.params[index] = param;
      }
      // check if is valid for the new unload evaluator params
      const error = isInvalid(state.conditions[0]);
      const { errorMsg: invalidErrorMsg, errorMsgFrom, errorMsgTo } = error ?? {};
      const errorMsg = invalidErrorMsg || errorMsgFrom || errorMsgTo;
      // set error in form manually as we don't have a field for the unload evaluator
      if (onError) {
        onError(errorMsg);
      }
    });
  }
);

function getUnloadEvaluatorTypeFromEvaluatorType(type: EvalFunction) {
  // we don't let the user change the unload evaluator type. We just change it to the opposite of the evaluator type
  if (type === EvalFunction.IsAbove) {
    return EvalFunction.IsBelow;
  }
  if (type === EvalFunction.IsBelow) {
    return EvalFunction.IsAbove;
  }
  if (type === EvalFunction.IsEqual) {
    return EvalFunction.IsNotEqual;
  }
  if (type === EvalFunction.IsNotEqual) {
    return EvalFunction.IsEqual;
  }
  if (type === EvalFunction.IsGreaterThanEqual) {
    return EvalFunction.IsLessThanEqual;
  }
  if (type === EvalFunction.IsLessThanEqual) {
    return EvalFunction.IsGreaterThanEqual;
  }
  if (type === EvalFunction.IsWithinRange) {
    return EvalFunction.IsOutsideRange;
  }
  if (type === EvalFunction.IsOutsideRange) {
    return EvalFunction.IsWithinRange;
  }
  if (type === EvalFunction.IsWithinRangeIncluded) {
    return EvalFunction.IsOutsideRangeIncluded;
  }
  if (type === EvalFunction.IsOutsideRangeIncluded) {
    return EvalFunction.IsWithinRangeIncluded;
  }
  return EvalFunction.IsBelow;
}

export function isInvalid(condition: ClassicCondition) {
  // first check if the unload evaluator values are not empty
  const { unloadEvaluator, evaluator } = condition;
  if (!evaluator) {
    return;
  }
  if (unloadEvaluator?.params[0] === undefined || Number.isNaN(unloadEvaluator?.params[0])) {
    return { errorMsg: 'This value cannot be empty' };
  }

  const { type, params: loadParams } = evaluator;
  const { params: unloadParams } = unloadEvaluator;

  if (
    type === EvalFunction.IsWithinRange ||
    type === EvalFunction.IsOutsideRange ||
    type === EvalFunction.IsWithinRangeIncluded ||
    type === EvalFunction.IsOutsideRangeIncluded
  ) {
    if (unloadParams[0] === undefined || Number.isNaN(unloadParams[0])) {
      return { errorMsgFrom: 'This value cannot be empty' };
    }
    if (unloadParams[1] === undefined || Number.isNaN(unloadParams[1])) {
      return { errorMsgTo: 'This value cannot be empty' };
    }
  }
  // check if the unload evaluator values are valid for the current load evaluator values
  const [firstParamInUnloadEvaluator, secondParamInUnloadEvaluator] = unloadEvaluator.params;
  const [firstParamInEvaluator, secondParamInEvaluator] = loadParams;

  switch (type) {
    case EvalFunction.IsAbove:
      if (firstParamInUnloadEvaluator > firstParamInEvaluator) {
        return { errorMsg: `Enter a number less than or equal to ${firstParamInEvaluator}` };
      }
      break;
    case EvalFunction.IsBelow:
      if (firstParamInUnloadEvaluator < firstParamInEvaluator) {
        return { errorMsg: `Enter a number more than or equal to ${firstParamInEvaluator}` };
      }
      break;
    case EvalFunction.IsEqual:
      if (firstParamInUnloadEvaluator === firstParamInEvaluator) {
        return { errorMsg: `Enter a different number than ${firstParamInEvaluator}` };
      }
      break;
    case EvalFunction.IsNotEqual:
      if (firstParamInUnloadEvaluator !== firstParamInEvaluator) {
        return { errorMsg: `Enter the same number as ${firstParamInEvaluator}` };
      }
      break;
    case EvalFunction.IsGreaterThanEqual:
      if (firstParamInUnloadEvaluator >= firstParamInEvaluator) {
        return { errorMsg: `Enter a number less than ${firstParamInEvaluator}` };
      }
      break;
    case EvalFunction.IsLessThanEqual:
      if (firstParamInUnloadEvaluator <= firstParamInEvaluator) {
        return { errorMsg: `Enter a number more than ${firstParamInEvaluator}` };
      }
      break;
    case EvalFunction.IsOutsideRange:
      if (firstParamInUnloadEvaluator < firstParamInEvaluator) {
        return { errorMsgFrom: `Enter a number more than or equal to ${firstParamInEvaluator}` };
      }
      if (secondParamInUnloadEvaluator > secondParamInEvaluator) {
        return { errorMsgTo: `Enter a number less than or equal to ${secondParamInEvaluator}` };
      }
      break;
    case EvalFunction.IsWithinRange:
      if (firstParamInUnloadEvaluator > firstParamInEvaluator) {
        return { errorMsgFrom: `Enter a number less than or equal to ${firstParamInEvaluator}` };
      }
      if (secondParamInUnloadEvaluator < secondParamInEvaluator) {
        return { errorMsgTo: `Enter a number be more than or equal to ${secondParamInEvaluator}` };
      }
      break;
    case EvalFunction.IsOutsideRangeIncluded:
      if (firstParamInUnloadEvaluator <= firstParamInEvaluator) {
        return { errorMsgFrom: `Enter a number more than ${firstParamInEvaluator}` };
      }
      if (secondParamInUnloadEvaluator >= secondParamInEvaluator) {
        return { errorMsgTo: `Enter a number less than ${secondParamInEvaluator}` };
      }
      break;
    case EvalFunction.IsWithinRangeIncluded:
      if (firstParamInUnloadEvaluator >= firstParamInEvaluator) {
        return { errorMsgFrom: `Enter a number less than ${firstParamInEvaluator}` };
      }
      if (secondParamInUnloadEvaluator <= secondParamInEvaluator) {
        return { errorMsgTo: `Enter a number be more than ${secondParamInEvaluator}` };
      }
      break;
    default:
      throw new Error(`evaluator function type ${type} not supported.`);
  }
  return;
}
