import * as z from 'zod';

import { ExpressionQueryType } from '../types';

import { type KnownFields, queryBaseMemory, queryBaseWire } from './common';

/**
 * A SQL query over the results of other queries. `expression` is SQL text (MySQL dialect), not a
 * refId - the backend works out what this depends on by reading the table names out of the SQL.
 */

/**
 * `alerting` makes the backend return a single number per series, which is what an alert rule
 * needs. Any other value (including an empty one) returns a table instead. The backend accepts any
 * string here, but only `alerting` means anything.
 */
export const SQL_FORMAT_ALERTING = 'alerting';

const shape = {
  type: z.literal(ExpressionQueryType.sql),
  expression: z.string(),
  format: z.literal(SQL_FORMAT_ALERTING).optional(),
};

export const sqlWireSchema = z.looseObject({
  ...queryBaseWire,
  ...shape,
  expression: z.string().catch(''),
  // Older or hand-written models can carry a format we do not use; drop it rather than reject.
  format: z.literal(SQL_FORMAT_ALERTING).optional().catch(undefined),
});

export const sqlMemorySchema = z.looseObject({
  ...queryBaseMemory,
  ...shape,
});

export type SqlExpressionQuery = KnownFields<z.infer<typeof sqlMemorySchema>>;

export const sqlCodec = z.codec(sqlWireSchema, sqlMemorySchema, {
  decode: (wire) => wire,
  encode: (memory) => memory,
});

/** The backend rejects an empty query outright. */
export const sqlSaveRules = sqlMemorySchema.refine((query) => query.expression.trim() !== '', {
  error: 'Enter a SQL expression.',
  path: ['expression'],
});
