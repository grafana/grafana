import * as z from 'zod';

import { EvalFunction } from '../../alerting/state/alertDef';
import { ExpressionQueryType } from '../types';

import {
  type KnownFields,
  THRESHOLD_EVAL_FUNCTIONS,
  type ThresholdEvalFunction,
  evaluatorMemory,
  evaluatorWire,
  hasEnoughParams,
  queryBaseMemory,
  queryBaseWire,
} from './common';

/**
 * Checks a series against a threshold.
 *
 * Two things about this type are easy to get wrong:
 *
 * - `expression` must be a plain refId. `reduce` and `resample` both tolerate a leading `$`, but
 *   threshold does not, and `$A` ends up looking for a query named `$A`. We do not rewrite it on
 *   read, because that would silently change a saved rule; the save rules reject it instead so the
 *   user finds out.
 * - The backend accepts exactly one condition. We still model the list as "one or more" so nothing
 *   is thrown away when reading a rule that somehow has more, and catch it on save.
 */

const conditionWireSchema = z.looseObject({
  evaluator: evaluatorWire(THRESHOLD_EVAL_FUNCTIONS).catch({
    type: EvalFunction.IsAbove,
    params: [],
  }),
  // `null` here means "no hysteresis", same as leaving it out.
  unloadEvaluator: evaluatorWire(THRESHOLD_EVAL_FUNCTIONS).nullish().catch(undefined),
  /**
   * Which series are currently firing. The server writes this in when it evaluates the rule; we
   * never author it, but it has to survive a read/write round trip or hysteresis resets and the
   * alert re-fires.
   */
  loadedFingerprints: z.array(z.string()).optional().catch(undefined),
  /** Superseded by loadedFingerprints. An encoded data frame, kept as-is. */
  loadedDimensions: z.unknown().optional(),
});

const conditionMemorySchema = z.looseObject({
  evaluator: evaluatorMemory(THRESHOLD_EVAL_FUNCTIONS),
  unloadEvaluator: evaluatorMemory(THRESHOLD_EVAL_FUNCTIONS).optional(),
  loadedFingerprints: z.array(z.string()).optional(),
  loadedDimensions: z.unknown().optional(),
});

export type ThresholdCondition = KnownFields<z.infer<typeof conditionMemorySchema>>;

/** Turns an evaluator function into one threshold actually supports, falling back to "is above". */
export function toThresholdEvalFunction(value: unknown): ThresholdEvalFunction {
  return THRESHOLD_EVAL_FUNCTIONS.find((fn) => fn === value) ?? EvalFunction.IsAbove;
}

/** Used when a saved rule has no condition at all, so the editor still has something to show. */
export const defaultThresholdCondition: ThresholdCondition = {
  evaluator: { type: EvalFunction.IsAbove, params: [0] },
};

export const thresholdWireSchema = z.looseObject({
  ...queryBaseWire,
  type: z.literal(ExpressionQueryType.threshold),
  expression: z.string().catch(''),
  conditions: z.array(conditionWireSchema).catch([]),
});

export const thresholdMemorySchema = z.looseObject({
  ...queryBaseMemory,
  type: z.literal(ExpressionQueryType.threshold),
  expression: z.string(),
  // One or more, so `conditions[0]` is always there without a check.
  conditions: z.tuple([conditionMemorySchema], conditionMemorySchema),
});

export type ThresholdExpressionQuery = KnownFields<z.infer<typeof thresholdMemorySchema>>;

export const thresholdCodec = z.codec(thresholdWireSchema, thresholdMemorySchema, {
  decode: (wire) => {
    const conditions = wire.conditions.map((condition) => ({
      ...condition,
      // Flatten `null` to missing so callers only have one "no hysteresis" case to handle.
      unloadEvaluator: condition.unloadEvaluator ?? undefined,
    }));

    // Split off the head so the type comes out as "one or more" rather than a plain array.
    const [first, ...rest] = conditions;
    const nonEmpty: [ThresholdCondition, ...ThresholdCondition[]] = first
      ? [first, ...rest]
      : [structuredClone(defaultThresholdCondition)];

    return { ...wire, conditions: nonEmpty };
  },
  encode: (memory) => ({
    ...memory,
    conditions: memory.conditions.map(({ unloadEvaluator, ...condition }) =>
      unloadEvaluator ? { ...condition, unloadEvaluator } : condition
    ),
  }),
});

export const thresholdSaveRules = thresholdMemorySchema
  .refine((query) => query.expression.trim() !== '', {
    error: 'Select a query to threshold.',
    path: ['expression'],
  })
  .refine((query) => !query.expression.startsWith('$'), {
    error: 'Reference the query by name only, without a leading "$".',
    path: ['expression'],
  })
  .refine((query) => query.conditions.length === 1, {
    error: 'A threshold takes exactly one condition.',
    path: ['conditions'],
  })
  .refine((query) => hasEnoughParams(query.conditions[0].evaluator), {
    error: 'Enter a threshold value.',
    path: ['conditions', 0, 'evaluator', 'params'],
  })
  .refine(
    (query) => {
      const unload = query.conditions[0].unloadEvaluator;
      return !unload || hasEnoughParams(unload);
    },
    {
      error: 'Enter a recovery threshold value.',
      path: ['conditions', 0, 'unloadEvaluator', 'params'],
    }
  );
