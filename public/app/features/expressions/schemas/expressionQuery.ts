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
 * Any expression query. Check `type` first: reading a field that only some types have is an
 * error until you do.
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
 * Reads one expression out of a saved rule. Never throws: anything malformed falls back to a
 * sensible default, so an old or hand-edited rule still opens. Unknown fields are kept.
 *
 * Returns undefined if the `type` is one we do not know, since there is nothing useful to show for
 * it. Callers already drop those.
 */
export function parseExpressionQuery(model: unknown): ExpressionQuery | undefined {
  // `safeParse` reads rather than writes, and takes anything - which is what we have, since
  // callers hand us whatever came back from the API.
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
 * Turns an expression back into the JSON we send: leaves `settings` out rather than sending null,
 * puts the `$` back where it belongs, and keeps any unknown fields that came in.
 */
export function encodeExpressionQuery(query: ExpressionQuery): ExpressionQueryWireModel {
  return z.encode(expressionQueryCodec, query);
}

/**
 * The stricter checks, for when someone saves. Kept off the codec on purpose - Zod would run them
 * while reading too, and an already-saved rule that breaks one would stop opening.
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
