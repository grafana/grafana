import * as z from 'zod';

import { ExpressionQueryType } from '../types';

import {
  type KnownFields,
  DOWNSAMPLER_IDS,
  type DownsamplerId,
  UPSAMPLER_IDS,
  type UpsamplerId,
  queryBaseMemory,
  queryBaseWire,
  stripRefIdPrefix,
} from './common';

/**
 * Re-spaces the timestamps in a series onto a regular interval.
 *
 * The backend does not check the sampler names while parsing - it only finds out they are wrong
 * when the rule runs - so the sets here are narrower than what would be accepted on save.
 */

export const DEFAULT_DOWNSAMPLER: DownsamplerId = 'mean';
export const DEFAULT_UPSAMPLER: UpsamplerId = 'fillna';

export function toDownsamplerId(value: unknown): DownsamplerId {
  return DOWNSAMPLER_IDS.find((id) => id === value) ?? DEFAULT_DOWNSAMPLER;
}

export function toUpsamplerId(value: unknown): UpsamplerId {
  return UPSAMPLER_IDS.find((id) => id === value) ?? DEFAULT_UPSAMPLER;
}

export const resampleWireSchema = z.looseObject({
  ...queryBaseWire,
  type: z.literal(ExpressionQueryType.resample),
  expression: z.string().catch(''),
  window: z.string().catch(''),
  // Explicitly optional: a bare z.unknown() still rejects a missing key.
  downsampler: z.unknown().optional(),
  upsampler: z.unknown().optional(),
});

export const resampleMemorySchema = z.looseObject({
  ...queryBaseMemory,
  type: z.literal(ExpressionQueryType.resample),
  expression: z.string(),
  window: z.string(),
  downsampler: z.enum(DOWNSAMPLER_IDS),
  upsampler: z.enum(UPSAMPLER_IDS),
});

export type ResampleExpressionQuery = KnownFields<z.infer<typeof resampleMemorySchema>>;

export const resampleCodec = z.codec(resampleWireSchema, resampleMemorySchema, {
  decode: (wire) => ({
    ...wire,
    expression: stripRefIdPrefix(wire.expression),
    downsampler: toDownsamplerId(wire.downsampler),
    upsampler: toUpsamplerId(wire.upsampler),
  }),
  encode: (memory) => memory,
});

export const resampleSaveRules = resampleMemorySchema
  .refine((query) => query.expression.trim() !== '', {
    error: 'Select a query to resample.',
    path: ['expression'],
  })
  .refine((query) => query.window.trim() !== '', {
    error: 'Enter a window duration, for example 10m.',
    path: ['window'],
  });
