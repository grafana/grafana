import * as z from 'zod';

import { EvalFunction } from '../../alerting/state/alertDef';
import { ExpressionQueryType } from '../types';

import {
  type KnownFields,
  CLASSIC_EVAL_FUNCTIONS,
  CLASSIC_REDUCER_IDS,
  type ClassicReducerId,
  evaluatorMemory,
  evaluatorWire,
  isRangeEvalFunction,
  queryBaseMemory,
  queryBaseWire,
} from './common';

/**
 * The old condition type. Each condition reduces one query, compares it to a number, and the
 * results are combined with and/or.
 *
 * Three ways it differs from `threshold`, all easy to trip over:
 *
 * - the reducer names differ, and the spelling has to match exactly - see CLASSIC_REDUCER_IDS
 * - a range comparison needs exactly two values here; threshold takes two or more
 * - `no_value` only works here
 */

export const CLASSIC_OPERATORS = ['and', 'or', 'logic-or'] as const;
export type ClassicOperator = (typeof CLASSIC_OPERATORS)[number];

const DEFAULT_CLASSIC_REDUCER: ClassicReducerId = 'avg';

/** Turns a Select value into a valid operator, falling back to `and`. */
export function toClassicOperator(value: unknown): ClassicOperator {
  return CLASSIC_OPERATORS.find((operator) => operator === value) ?? 'and';
}

const conditionWireSchema = z.looseObject({
  // The backend drops this, but saved rules carry it and a round trip should not remove it.
  type: z.literal('query').catch('query'),
  evaluator: evaluatorWire(CLASSIC_EVAL_FUNCTIONS).catch({
    type: EvalFunction.IsAbove,
    params: [],
  }),
  operator: z
    .looseObject({ type: z.enum(CLASSIC_OPERATORS).catch('and') })
    .optional()
    .catch(undefined),
  query: z.looseObject({ params: z.array(z.string()).catch([]) }).catch({ params: [] }),
  /**
   * Rules created by older versions, and provisioned ones, can be missing this entirely. The
   * editor reads into it without checking, so fill it in on the way through.
   */
  reducer: z
    .looseObject({
      type: z.enum(CLASSIC_REDUCER_IDS).catch(DEFAULT_CLASSIC_REDUCER),
      params: z.array(z.unknown()).catch([]),
    })
    .optional()
    .catch(undefined),
});

const conditionMemorySchema = z.looseObject({
  type: z.literal('query'),
  evaluator: evaluatorMemory(CLASSIC_EVAL_FUNCTIONS),
  operator: z.looseObject({ type: z.enum(CLASSIC_OPERATORS) }).optional(),
  query: z.looseObject({ params: z.array(z.string()) }),
  reducer: z.looseObject({
    type: z.enum(CLASSIC_REDUCER_IDS),
    params: z.array(z.unknown()),
  }),
});

export type ClassicCondition = KnownFields<z.infer<typeof conditionMemorySchema>>;

export const defaultClassicCondition: ClassicCondition = {
  type: 'query',
  reducer: { params: [], type: DEFAULT_CLASSIC_REDUCER },
  operator: { type: 'and' },
  query: { params: [] },
  evaluator: { params: [0, 0], type: EvalFunction.IsAbove },
};

export const classicWireSchema = z.looseObject({
  ...queryBaseWire,
  type: z.literal(ExpressionQueryType.classic),
  // The backend is happy with a missing or null list, so we have to be too.
  conditions: z.array(conditionWireSchema).catch([]),
});

export const classicMemorySchema = z.looseObject({
  ...queryBaseMemory,
  type: z.literal(ExpressionQueryType.classic),
  conditions: z.array(conditionMemorySchema),
});

export type ClassicExpressionQuery = KnownFields<z.infer<typeof classicMemorySchema>>;

export const classicCodec = z.codec(classicWireSchema, classicMemorySchema, {
  decode: (wire) => ({
    ...wire,
    conditions: wire.conditions.map((condition) => ({
      ...condition,
      reducer: condition.reducer ?? { params: [], type: DEFAULT_CLASSIC_REDUCER },
    })),
  }),
  encode: (memory) => memory,
});

/** Range evaluators need exactly two parameters, `no_value` needs none, everything else needs one. */
function classicEvaluatorParamCountOk(evaluator: ClassicCondition['evaluator']): boolean {
  if (evaluator.type === EvalFunction.HasNoValue) {
    return true;
  }
  if (isRangeEvalFunction(evaluator.type)) {
    return evaluator.params.length === 2;
  }
  return evaluator.params.length >= 1;
}

export const classicSaveRules = classicMemorySchema
  .refine((query) => query.conditions.length > 0, {
    error: 'Add at least one condition.',
    path: ['conditions'],
  })
  .refine((query) => query.conditions.every((condition) => condition.query.params[0]), {
    error: 'Every condition needs a query to read from.',
    path: ['conditions'],
  })
  .refine((query) => query.conditions.every((condition) => classicEvaluatorParamCountOk(condition.evaluator)), {
    error: 'A range condition needs two values; the others need one.',
    path: ['conditions'],
  });
