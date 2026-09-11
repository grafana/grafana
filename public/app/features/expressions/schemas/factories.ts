import { ExpressionDatasourceRef } from '@grafana/runtime/internal';

import { ExpressionQueryType } from '../types';

import { type ClassicExpressionQuery, defaultClassicCondition } from './classic';
import type { DownsamplerId, ReduceReducerId, UpsamplerId } from './common';
import { type ExpressionQuery, isClassicExpression } from './expressionQuery';
import type { MathExpressionQuery } from './math';
import { DEFAULT_REDUCE_REDUCER, type ReduceExpressionQuery } from './reduce';
import { DEFAULT_DOWNSAMPLER, DEFAULT_UPSAMPLER, type ResampleExpressionQuery } from './resample';
import type { SqlExpressionQuery } from './sql';
import { type ThresholdExpressionQuery, defaultThresholdCondition } from './threshold';

/**
 * Builders for new expressions.
 *
 * Before these existed, five different places built their own reduce-and-threshold pair by hand
 * and two of them had already drifted apart. Everything that creates an expression should come
 * through here so there is only one set of defaults to keep straight.
 */

/** What every expression carries, whatever its type. */
export interface ExpressionBase {
  refId: string;
  hide?: boolean;
  datasource?: ExpressionQuery['datasource'];
}

function base({ refId, hide, datasource = ExpressionDatasourceRef }: ExpressionBase) {
  return hide === undefined ? { refId, datasource } : { refId, hide, datasource };
}

export function makeMathExpression(from: ExpressionBase, expression = ''): MathExpressionQuery {
  return { ...base(from), type: ExpressionQueryType.math, expression };
}

export function makeReduceExpression(
  from: ExpressionBase,
  { expression = '', reducer = DEFAULT_REDUCE_REDUCER }: { expression?: string; reducer?: ReduceReducerId } = {}
): ReduceExpressionQuery {
  return { ...base(from), type: ExpressionQueryType.reduce, expression, reducer };
}

export function makeResampleExpression(
  from: ExpressionBase,
  {
    expression = '',
    window = '',
    downsampler = DEFAULT_DOWNSAMPLER,
    upsampler = DEFAULT_UPSAMPLER,
  }: { expression?: string; window?: string; downsampler?: DownsamplerId; upsampler?: UpsamplerId } = {}
): ResampleExpressionQuery {
  return { ...base(from), type: ExpressionQueryType.resample, expression, window, downsampler, upsampler };
}

export function makeThresholdExpression(
  from: ExpressionBase,
  { expression = '' }: { expression?: string } = {}
): ThresholdExpressionQuery {
  return {
    ...base(from),
    type: ExpressionQueryType.threshold,
    expression,
    conditions: [structuredClone(defaultThresholdCondition)],
  };
}

export function makeClassicExpression(from: ExpressionBase): ClassicExpressionQuery {
  return {
    ...base(from),
    type: ExpressionQueryType.classic,
    conditions: [structuredClone(defaultClassicCondition)],
  };
}

export function makeSqlExpression(
  from: ExpressionBase,
  { expression = '', format }: { expression?: string; format?: 'alerting' } = {}
): SqlExpressionQuery {
  return format
    ? { ...base(from), type: ExpressionQueryType.sql, expression, format }
    : { ...base(from), type: ExpressionQueryType.sql, expression, format: undefined };
}

/** Builds an empty expression of the given type. */
export function makeExpression(type: ExpressionQueryType, from: ExpressionBase, expression?: string): ExpressionQuery {
  switch (type) {
    case ExpressionQueryType.math:
      return makeMathExpression(from, expression);
    case ExpressionQueryType.reduce:
      return makeReduceExpression(from, { expression });
    case ExpressionQueryType.resample:
      return makeResampleExpression(from, { expression });
    case ExpressionQueryType.threshold:
      return makeThresholdExpression(from, { expression });
    case ExpressionQueryType.classic:
      return makeClassicExpression(from);
    case ExpressionQueryType.sql:
      return makeSqlExpression(from, { expression });
  }
}

/**
 * What this expression reads from. For most types that is a single refId; for math it is a whole
 * formula, and for SQL it is the query text. Classic conditions do not have one - each of their
 * conditions names its own query.
 */
export function getExpressionInput(query: ExpressionQuery): string | undefined {
  return isClassicExpression(query) ? undefined : query.expression;
}

/**
 * Sets what the expression reads from, when the type has such a field. Classic conditions are
 * returned unchanged.
 */
export function withExpressionInput(query: ExpressionQuery, expression: string): ExpressionQuery {
  return isClassicExpression(query) ? query : { ...query, expression };
}

/**
 * Swaps an expression to a different type, keeping the refId and data source. Fields that only
 * made sense for the old type are dropped rather than carried over, which is what the editor wants
 * and what the old in-place `getDefaults` was trying to do by clearing them one at a time.
 */
export function changeExpressionType(query: ExpressionQuery, type: ExpressionQueryType): ExpressionQuery {
  // Picking the type it already is should not throw away the settings that go with it.
  if (query.type === type) {
    return query;
  }

  return makeExpression(type, query, getExpressionInput(query));
}
