import * as z from 'zod';

import { ExpressionQueryType, ReducerMode } from '../types';

import {
  type KnownFields,
  REDUCE_REDUCER_IDS,
  type ReduceReducerId,
  queryBaseMemory,
  queryBaseWire,
  stripRefIdPrefix,
} from './common';

/** Turns each series from another query into a single number. */

export const DEFAULT_REDUCE_REDUCER: ReduceReducerId = 'mean';

/** The backend lower-cases the reducer before looking it up, so `MAX` and `max` both work. */
export function toReduceReducerId(value: unknown): ReduceReducerId {
  if (typeof value !== 'string') {
    return DEFAULT_REDUCE_REDUCER;
  }
  const lowered = value.toLowerCase();
  return REDUCE_REDUCER_IDS.find((id) => id === lowered) ?? DEFAULT_REDUCE_REDUCER;
}

const settingsMemorySchema = z.looseObject({
  mode: z.enum(ReducerMode).optional(),
  replaceWithValue: z.number().optional(),
});

export type ExpressionQuerySettings = KnownFields<z.infer<typeof settingsMemorySchema>>;

export const reduceWireSchema = z.looseObject({
  ...queryBaseWire,
  type: z.literal(ExpressionQueryType.reduce),
  expression: z.string().catch(''),
  // Kept loose so an unrecognised reducer falls back rather than failing the whole read, and
  // explicitly optional because a bare z.unknown() still rejects a missing key. The codec narrows
  // whatever turns up to the real set.
  reducer: z.unknown().optional(),
  settings: z
    .looseObject({
      mode: z.enum(ReducerMode).optional().catch(undefined),
      replaceWithValue: z.number().optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
});

export const reduceMemorySchema = z.looseObject({
  ...queryBaseMemory,
  type: z.literal(ExpressionQueryType.reduce),
  expression: z.string(),
  reducer: z.enum(REDUCE_REDUCER_IDS),
  settings: settingsMemorySchema.optional(),
});

export type ReduceExpressionQuery = KnownFields<z.infer<typeof reduceMemorySchema>>;

export const reduceCodec = z.codec(reduceWireSchema, reduceMemorySchema, {
  decode: (wire) => ({
    ...wire,
    expression: stripRefIdPrefix(wire.expression),
    reducer: toReduceReducerId(wire.reducer),
  }),
  encode: ({ settings, ...rest }) => {
    // `settings: null` is rejected by the backend, and so is any non-object. Leave the key out
    // entirely when there is nothing to send.
    return settings ? { ...rest, settings } : rest;
  },
});

export const reduceSaveRules = reduceMemorySchema
  .refine((query) => query.expression.trim() !== '', {
    error: 'Select a query to reduce.',
    path: ['expression'],
  })
  .refine(
    (query) =>
      // The backend only requires a replacement value in `replaceNN` mode; it ignores the field
      // otherwise.
      query.settings?.mode !== ReducerMode.ReplaceNonNumbers || typeof query.settings.replaceWithValue === 'number',
    {
      error: 'Enter a replacement value.',
      path: ['settings', 'replaceWithValue'],
    }
  );
