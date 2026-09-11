import * as z from 'zod';

import { logWarning } from '@grafana/runtime';

import { ExpressionQueryType } from '../types';

import { type ClassicExpressionQuery, classicCodec, classicSaveRules } from './classic';
import { type MathExpressionQuery, mathCodec, mathSaveRules } from './math';
import { type ReduceExpressionQuery, reduceCodec, reduceSaveRules } from './reduce';
import { type ResampleExpressionQuery, resampleCodec, resampleSaveRules } from './resample';
import { type SqlExpressionQuery, sqlCodec, sqlSaveRules } from './sql';
import { type ThresholdExpressionQuery, thresholdCodec, thresholdSaveRules } from './threshold';

/**
 * Ties the per-type schemas together. Nothing is re-exported from here - this repo does not allow
 * barrel files under public/app - so import the per-type pieces from their own file.
 */

/**
 * One expression query, narrowed by its `type`. Reading a field that only some types have is a
 * compile error until you check the type first, which is the whole point of splitting these up.
 */
export type ExpressionQuery =
  | MathExpressionQuery
  | ReduceExpressionQuery
  | ResampleExpressionQuery
  | ThresholdExpressionQuery
  | ClassicExpressionQuery
  | SqlExpressionQuery;

/** Converts between the JSON stored in a rule and the in-memory form, in both directions. */
export const expressionQueryCodec = z.discriminatedUnion('type', [
  mathCodec,
  reduceCodec,
  resampleCodec,
  thresholdCodec,
  classicCodec,
  sqlCodec,
]);

/** The JSON shape as stored in a rule, which is what encoding produces. */
export type ExpressionQueryWireModel = z.input<typeof expressionQueryCodec>;

const saveRulesByType = {
  [ExpressionQueryType.math]: mathSaveRules,
  [ExpressionQueryType.reduce]: reduceSaveRules,
  [ExpressionQueryType.resample]: resampleSaveRules,
  [ExpressionQueryType.threshold]: thresholdSaveRules,
  [ExpressionQueryType.classic]: classicSaveRules,
  [ExpressionQueryType.sql]: sqlSaveRules,
} as const;

/**
 * Reads one expression model out of a saved rule.
 *
 * This never throws. Anything malformed falls back to a sensible default so a rule that was saved
 * by an older version, or hand-edited, still opens in the editor. Unknown fields are kept.
 *
 * Returns undefined when the model has no `type` we recognise - there is nothing sensible to show
 * for one of those, and callers already drop them.
 */
export function parseExpressionQuery(model: unknown): ExpressionQuery | undefined {
  // safeParse on a codec runs the decode direction and accepts unknown, which is what we have
  // here - callers read this straight off an API response.
  const result = expressionQueryCodec.safeParse(model);

  if (!result.success) {
    logWarning('Could not read expression query model', {
      type: typeof model === 'object' && model !== null && 'type' in model ? String(model.type) : 'missing',
      issues: String(result.error.issues.length),
    });
    return undefined;
  }

  return result.data;
}

/**
 * Turns an in-memory expression back into the JSON we send. Drops `settings` rather than sending
 * null, puts the `$` convention back where it belongs, and keeps any unknown fields that came in.
 */
export function encodeExpressionQuery(query: ExpressionQuery): ExpressionQueryWireModel {
  return z.encode(expressionQueryCodec, query);
}

/**
 * The stricter checks, for when the user saves.
 *
 * Kept separate from the codec on purpose: Zod checks the in-memory side of a codec while reading
 * as well as while writing, so putting these on the codec would stop an already-saved rule that
 * breaks one of them from opening at all.
 */
export function validateExpressionQuery(query: ExpressionQuery) {
  return saveRulesByType[query.type].safeParse(query);
}

export function isMathExpression(query: ExpressionQuery): query is MathExpressionQuery {
  return query.type === ExpressionQueryType.math;
}

export function isReduceExpression(query: ExpressionQuery): query is ReduceExpressionQuery {
  return query.type === ExpressionQueryType.reduce;
}

export function isResampleExpression(query: ExpressionQuery): query is ResampleExpressionQuery {
  return query.type === ExpressionQueryType.resample;
}

export function isThresholdExpression(query: ExpressionQuery): query is ThresholdExpressionQuery {
  return query.type === ExpressionQueryType.threshold;
}

export function isClassicExpression(query: ExpressionQuery): query is ClassicExpressionQuery {
  return query.type === ExpressionQueryType.classic;
}

export function isSqlExpression(query: ExpressionQuery): query is SqlExpressionQuery {
  return query.type === ExpressionQueryType.sql;
}
