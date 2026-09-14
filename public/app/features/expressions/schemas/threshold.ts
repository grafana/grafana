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
import type { ExpressionIssueId, FieldPath } from './issues';

/**
 * Checks a series against a threshold. Two things here are easy to get wrong:
 *
 * - `expression` has to be a plain query name. `reduce` and `resample` ignore a leading `$`, but
 *   threshold does not and would look for a query called `$A`. We leave it alone when reading,
 *   since rewriting it would change someone's saved rule behind their back, and reject it on save
 *   instead so they hear about it.
 * - Only one condition is allowed. The list is typed as "one or more" anyway, so a rule that
 *   somehow has more does not lose them on the way in, and saving is what complains.
 */

const conditionWireSchema = z.looseObject({
  evaluator: evaluatorWire(THRESHOLD_EVAL_FUNCTIONS).catch({
    type: EvalFunction.IsAbove,
    params: [],
  }),
  // `null` means no recovery threshold, same as leaving it out.
  unloadEvaluator: evaluatorWire(THRESHOLD_EVAL_FUNCTIONS).nullish().catch(undefined),
  /**
   * Which series are already firing. The server fills this in when it evaluates the rule. We never
   * set it, but it has to survive being read and written again - lose it and the alert forgets it
   * was firing and goes off a second time.
   */
  loadedFingerprints: z.array(z.string()).optional().catch(undefined),
  /** The older version of the field above. Passed through as-is. */
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

/** Where the single value, or the low end of a range, lives on the recovery threshold. */
const RECOVERY_FIRST: FieldPath = ['conditions', 0, 'unloadEvaluator', 'params', 0];
/** Where the high end of a range lives on the recovery threshold. */
const RECOVERY_SECOND: FieldPath = ['conditions', 0, 'unloadEvaluator', 'params', 1];

/**
 * The recovery threshold inputs show their own problems, so whatever renders the expression card
 * should leave these to the threshold editor rather than repeating them.
 */
export const RECOVERY_VALUE_PATHS: FieldPath[] = [RECOVERY_FIRST, RECOVERY_SECOND];

/**
 * Checks the recovery threshold sits on the right side of the threshold itself, which depends on
 * the comparison being used. Moved here from `isInvalid` in `components/thresholdReducer.ts`, so
 * these rules and the ones above live in one place.
 */
function checkRecoveryThreshold(
  evaluator: ThresholdCondition['evaluator'],
  recovery: ThresholdCondition['evaluator'],
  report: (id: ExpressionIssueId, path: FieldPath, limit: number) => void
) {
  const [firstValue, secondValue] = evaluator.params;
  const [firstRecovery, secondRecovery] = recovery.params;

  switch (evaluator.type) {
    case EvalFunction.IsAbove:
      if (firstRecovery > firstValue) {
        report('threshold.recovery.at-most', RECOVERY_FIRST, firstValue);
      }
      return;

    case EvalFunction.IsBelow:
      if (firstRecovery < firstValue) {
        report('threshold.recovery.at-least', RECOVERY_FIRST, firstValue);
      }
      return;

    case EvalFunction.IsEqual:
      if (firstRecovery === firstValue) {
        report('threshold.recovery.different', RECOVERY_FIRST, firstValue);
      }
      return;

    // Kept exactly as it has always behaved: this one asks for the recovery value to *match* the
    // threshold, which is the opposite of every other case here and the reverse of `IsEqual` just
    // above. Whether that is the right thing for alerting to do is a separate question - do not
    // "fix" it by pattern-matching the neighbours. A test pins this.
    case EvalFunction.IsNotEqual:
      if (firstRecovery !== firstValue) {
        report('threshold.recovery.same', RECOVERY_FIRST, firstValue);
      }
      return;

    case EvalFunction.IsGreaterThanEqual:
      if (firstRecovery >= firstValue) {
        report('threshold.recovery.less-than', RECOVERY_FIRST, firstValue);
      }
      return;

    case EvalFunction.IsLessThanEqual:
      if (firstRecovery <= firstValue) {
        report('threshold.recovery.more-than', RECOVERY_FIRST, firstValue);
      }
      return;

    case EvalFunction.IsOutsideRange:
      if (firstRecovery < firstValue) {
        report('threshold.recovery.at-least', RECOVERY_FIRST, firstValue);
      } else if (secondRecovery > secondValue) {
        report('threshold.recovery.at-most', RECOVERY_SECOND, secondValue);
      }
      return;

    case EvalFunction.IsWithinRange:
      if (firstRecovery > firstValue) {
        report('threshold.recovery.at-most', RECOVERY_FIRST, firstValue);
      } else if (secondRecovery < secondValue) {
        report('threshold.recovery.at-least', RECOVERY_SECOND, secondValue);
      }
      return;

    case EvalFunction.IsOutsideRangeIncluded:
      if (firstRecovery <= firstValue) {
        report('threshold.recovery.more-than', RECOVERY_FIRST, firstValue);
      } else if (secondRecovery >= secondValue) {
        report('threshold.recovery.less-than', RECOVERY_SECOND, secondValue);
      }
      return;

    case EvalFunction.IsWithinRangeIncluded:
      if (firstRecovery >= firstValue) {
        report('threshold.recovery.less-than', RECOVERY_FIRST, firstValue);
      } else if (secondRecovery <= secondValue) {
        report('threshold.recovery.more-than', RECOVERY_SECOND, secondValue);
      }
      return;
  }
}

export const thresholdSaveRules = thresholdMemorySchema
  .refine((query) => query.expression.trim() !== '', {
    error: 'threshold.expression.required' satisfies ExpressionIssueId,
    path: ['expression'],
  })
  .refine((query) => !query.expression.startsWith('$'), {
    error: 'threshold.expression.bare-name' satisfies ExpressionIssueId,
    path: ['expression'],
  })
  .refine((query) => query.conditions.length === 1, {
    error: 'threshold.conditions.one-only' satisfies ExpressionIssueId,
    path: ['conditions'],
  })
  .refine((query) => hasEnoughParams(query.conditions[0].evaluator), {
    error: 'threshold.value.required' satisfies ExpressionIssueId,
    path: ['conditions', 0, 'evaluator', 'params'],
  })
  // `.check` rather than `.refine` because these messages need the threshold value to compare
  // against, and only `.check` can attach it to the issue.
  .check((ctx) => {
    const [condition] = ctx.value.conditions;
    const recovery = condition.unloadEvaluator;

    if (!recovery) {
      return;
    }

    const report = (id: ExpressionIssueId, path: FieldPath, limit: number) =>
      ctx.issues.push({ code: 'custom', input: ctx.value, message: id, path: [...path], params: { limit } });

    // An empty box comes through as no params at all, since a blank input is not a number.
    if (!hasEnoughParams(recovery)) {
      ctx.issues.push({
        code: 'custom',
        input: ctx.value,
        message: 'threshold.recovery.required' satisfies ExpressionIssueId,
        path: [...RECOVERY_FIRST],
      });
      return;
    }

    checkRecoveryThreshold(condition.evaluator, recovery, report);
  });
