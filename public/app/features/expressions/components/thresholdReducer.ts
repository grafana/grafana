import { createAction, createReducer } from '@reduxjs/toolkit';

import { EvalFunction } from 'app/features/alerting/state/alertDef';

import { type ClassicCondition, ExpressionQueryType, type ThresholdExpressionQuery } from '../types';
import { isRangeEvaluator } from '../utils/expressionTypes';

export const updateRefId = createAction<string | undefined>('thresold/updateRefId');
export const updateThresholdType = createAction<{
  evalFunction: EvalFunction;
  onError: ((error: string | undefined) => void) | undefined;
}>('thresold/updateThresholdType');
export const updateThresholdParams = createAction<{
  param: number;
  index: number;
  onError: ((error: string | undefined) => void) | undefined;
}>('thresold/updateThresholdParams');
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

      // Determine arity change before overwriting the type.
      // Only reset params when crossing the single ↔ range boundary:
      //   single → range : reset to [0, 0]  (need two params)
      //   range  → single: reset to [0]     (drop second param; fixes stale [from, to] array)
      //   single → single: preserve existing value (fixes value silently resetting to 0)
      //   range  → range : preserve existing values
      const previouslyRange = isRangeEvaluator(state.conditions[0].evaluator.type);
      const nowRange = isRangeEvaluator(typeInPayload);
      if (previouslyRange !== nowRange) {
        state.conditions[0].evaluator.params = nowRange ? [0, 0] : [0];
      } else if (!nowRange) {
        // Ensure single-value types always carry exactly one param element.
        // Older rules may have been saved with a 2-element array from a prior range type.
        state.conditions[0].evaluator.params = [state.conditions[0].evaluator.params[0] ?? 0];
      }

      //set new type in evaluator
      state.conditions[0].evaluator.type = typeInPayload;

      // check if hysteresis is checked
      const hsyteresisIsChecked = Boolean(state.conditions[0].unloadEvaluator);

      if (hsyteresisIsChecked) {
        applyDefaultUnloadEvaluator(state.conditions[0], onError);
      }
    });
    builder.addCase(updateThresholdParams, (state, action) => {
      const { param, index, onError } = action.payload;
      state.conditions[0].evaluator.params[index] = param;
      // Moving the threshold can turn a valid recovery threshold invalid, and can also fix an
      // invalid one, so the error has to be re-evaluated here and not only when the recovery
      // threshold itself is edited.
      if (state.conditions[0].unloadEvaluator) {
        reportValidation(state.conditions[0], onError);
      }
    });
    builder.addCase(updateHysteresisChecked, (state, action) => {
      const { hysteresisChecked, onError } = action.payload;
      if (!hysteresisChecked) {
        state.conditions[0].unloadEvaluator = undefined;
        if (onError) {
          onError(undefined); // clear error
        }
      } else {
        applyDefaultUnloadEvaluator(state.conditions[0], onError);
      }
    });
    builder.addCase(updateUnloadParams, (state, action) => {
      const { param, index, onError } = action.payload;
      // if there is no unload evaluator, we use the default evaluator params
      if (!state.conditions[0].unloadEvaluator) {
        applyDefaultUnloadEvaluator(state.conditions[0], onError);
      } else {
        // only update the param
        state.conditions[0].unloadEvaluator.params[index] = param;
        reportValidation(state.conditions[0], onError);
      }
    });
  }
);

type OnError = ((error: string | undefined) => void) | undefined;

// The recovery threshold has no field of its own, so its validation errors have to be pushed into
// the form manually.
function reportValidation(condition: ClassicCondition, onError: OnError) {
  if (!onError) {
    return;
  }
  const { errorMsg, errorMsgFrom, errorMsgTo } = isInvalid(condition) ?? {};
  onError(errorMsg || errorMsgFrom || errorMsgTo);
}

// The recovery value defaults to the threshold value, which is not valid for every operator: for
// "is equal to" an identical value makes the rule flap between Alerting and Normal on every
// evaluation. So the default has to be validated, not assumed to be valid.
function applyDefaultUnloadEvaluator(condition: ClassicCondition, onError: OnError) {
  condition.unloadEvaluator = {
    type: getUnloadEvaluatorTypeFromEvaluatorType(condition.evaluator.type),
    // Copied, so that later edits to the threshold don't mutate the recovery value through a shared array.
    params: [...(condition.evaluator?.params ?? [0, 0])],
  };
  reportValidation(condition, onError);
}

// The user cannot pick the recovery type: it is derived from the threshold type, as the alert
// recovers when the condition that made it fire stops holding. Equality has no directional
// opposite, so both equality thresholds recover when the value equals the recovery value.
const recoveryTypeByThresholdType: Partial<Record<EvalFunction, EvalFunction>> = {
  [EvalFunction.IsAbove]: EvalFunction.IsBelow,
  [EvalFunction.IsBelow]: EvalFunction.IsAbove,
  [EvalFunction.IsEqual]: EvalFunction.IsEqual,
  [EvalFunction.IsNotEqual]: EvalFunction.IsEqual,
  [EvalFunction.IsGreaterThanEqual]: EvalFunction.IsLessThanEqual,
  [EvalFunction.IsLessThanEqual]: EvalFunction.IsGreaterThanEqual,
  [EvalFunction.IsWithinRange]: EvalFunction.IsOutsideRange,
  [EvalFunction.IsOutsideRange]: EvalFunction.IsWithinRange,
  [EvalFunction.IsWithinRangeIncluded]: EvalFunction.IsOutsideRangeIncluded,
  [EvalFunction.IsOutsideRangeIncluded]: EvalFunction.IsWithinRangeIncluded,
};

function getUnloadEvaluatorTypeFromEvaluatorType(type: EvalFunction) {
  return recoveryTypeByThresholdType[type] ?? EvalFunction.IsBelow;
}

// Rules saved before the eq/ne recovery fix carry a recovery type that no longer matches the one
// derived from their threshold, which the UI can neither display nor edit correctly. The type is
// derived state, so recomputing it does not discard anything the user chose.
export function normalizeUnloadEvaluator(condition: ClassicCondition): ClassicCondition {
  const { evaluator, unloadEvaluator } = condition;
  const recoveryType = recoveryTypeByThresholdType[evaluator.type];

  if (!unloadEvaluator || !recoveryType || unloadEvaluator.type === recoveryType) {
    return condition;
  }

  return { ...condition, unloadEvaluator: { ...unloadEvaluator, type: recoveryType } };
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
