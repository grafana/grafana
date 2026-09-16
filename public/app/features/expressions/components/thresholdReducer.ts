import { createAction, createReducer } from '@reduxjs/toolkit';

import { EvalFunction } from 'app/features/alerting/state/alertDef';

import type { ThresholdEvalFunction } from '../schemas/common';
import {
  defaultThresholdCondition,
  type ThresholdCondition,
  type ThresholdExpressionQuery,
} from '../schemas/threshold';
import { ExpressionQueryType } from '../types';
import { isRangeEvaluator } from '../utils/expressionTypes';

export const updateRefId = createAction<string | undefined>('thresold/updateRefId');
export const updateThresholdType = createAction<{ evalFunction: EvalFunction }>('thresold/updateThresholdType');
export const updateThresholdParams = createAction<{ param: number; index: number }>('thresold/updateThresholdParams');
export const updateHysteresisChecked = createAction<{ hysteresisChecked: boolean }>('thresold/updateHysteresis');
export const updateUnloadParams = createAction<{ param: number; index: number }>('thresold/updateUnloadParams');

export const thresholdReducer = createReducer<ThresholdExpressionQuery>(
  {
    type: ExpressionQueryType.threshold,
    refId: '',
    expression: '',
    conditions: [structuredClone(defaultThresholdCondition)],
  },
  (builder) => {
    builder.addCase(updateRefId, (state, action) => {
      state.expression = action.payload ?? '';
    });
    builder.addCase(updateThresholdType, (state, action) => {
      const typeInPayload = action.payload.evalFunction;

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
        applyDefaultUnloadEvaluator(state.conditions[0]);
      }
    });
    builder.addCase(updateThresholdParams, (state, action) => {
      const { param, index } = action.payload;
      state.conditions[0].evaluator.params[index] = param;
    });
    builder.addCase(updateHysteresisChecked, (state, action) => {
      const { hysteresisChecked } = action.payload;
      if (!hysteresisChecked) {
        state.conditions[0].unloadEvaluator = undefined;
      } else {
        applyDefaultUnloadEvaluator(state.conditions[0]);
      }
    });
    builder.addCase(updateUnloadParams, (state, action) => {
      const { param, index } = action.payload;
      // if there is no unload evaluator, we use the default evaluator params
      if (!state.conditions[0].unloadEvaluator) {
        applyDefaultUnloadEvaluator(state.conditions[0]);
      } else {
        state.conditions[0].unloadEvaluator.params[index] = param;
      }
    });
  }
);

/**
 * Starts the recovery threshold off at the same value as the threshold, flipped to the opposite
 * comparison. Not always a valid pairing - "is equal to" would flap on every evaluation - so the
 * save rules check it and the editor shows the problem.
 */
function applyDefaultUnloadEvaluator(condition: ThresholdCondition) {
  condition.unloadEvaluator = {
    type: getUnloadEvaluatorTypeFromEvaluatorType(condition.evaluator.type),
    // Copied, so later edits to the threshold don't reach through a shared array.
    params: [...(condition.evaluator?.params ?? [0, 0])],
  };
}

function getUnloadEvaluatorTypeFromEvaluatorType(type: EvalFunction): ThresholdEvalFunction {
  // we don't let the user change the unload evaluator type. We just change it to the opposite of the evaluator type
  if (type === EvalFunction.IsAbove) {
    return EvalFunction.IsBelow;
  }
  if (type === EvalFunction.IsBelow) {
    return EvalFunction.IsAbove;
  }
  // Equality has no directional opposite. Both equal/not-equal thresholds recover when the
  // value equals the recovery value, so the unload evaluator is IsEqual in both cases.
  if (type === EvalFunction.IsEqual) {
    return EvalFunction.IsEqual;
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
