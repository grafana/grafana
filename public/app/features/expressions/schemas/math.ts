import * as z from 'zod';

import { ExpressionQueryType } from '../types';

import { type KnownFields, queryBaseMemory, queryBaseWire } from './common';

/**
 * A free-form formula over other queries, referencing them as `$A`. Unlike the other types the
 * expression here is a formula rather than a single refId, so there is no `$` stripping to do.
 */

const shape = {
  type: z.literal(ExpressionQueryType.math),
  expression: z.string(),
};

export const mathWireSchema = z.looseObject({
  ...queryBaseWire,
  ...shape,
  expression: z.string().catch(''),
});

export const mathMemorySchema = z.looseObject({
  ...queryBaseMemory,
  ...shape,
});

export type MathExpressionQuery = KnownFields<z.infer<typeof mathMemorySchema>>;

export const mathCodec = z.codec(mathWireSchema, mathMemorySchema, {
  decode: (wire) => wire,
  encode: (memory) => memory,
});

/** An empty formula fails to parse in the backend, so block it before the user saves. */
export const mathSaveRules = mathMemorySchema.refine((query) => query.expression.trim() !== '', {
  error: 'Enter a math expression.',
  path: ['expression'],
});
