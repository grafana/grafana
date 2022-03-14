//@ts-nocheck
import { z, ZodError } from 'zod';
import { Result } from '@utils/fp';
import { modelToResult } from './utils';

const zDateTime = z.string().transform((value) => Date.parse(value));

export const apikeyModel = z.object({
  id: z.number(),
  name: z.string(),
  role: z.string(),
  key: z.optional(z.string()),
  createdAt: zDateTime,
  expiresAt: z.optional(zDateTime),
});

export const apikeysModel = z.array(apikeyModel);

export type APIKeys = z.infer<typeof apikeysModel>;
export type APIKey = z.infer<typeof apikeyModel>;

export function parse(a: unknown): Result<APIKeys, ZodError> {
  return modelToResult(apikeysModel, a);
}
