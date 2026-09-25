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
 * Builders for new expressions. Five places used to write their own defaults by hand, and two had
 * already drifted apart, so create expressions through here.
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

/** Points the expression at a different query. Classic conditions come back unchanged. */
export function withExpressionInput(query: ExpressionQuery, expression: string): ExpressionQuery {
  return isClassicExpression(query) ? query : { ...query, expression };
}

/**
 * Changes an expression to a different type, keeping its name and data source. Fields that only
 * made sense for the old type are dropped rather than carried over.
 */
export function changeExpressionType(query: ExpressionQuery, type: ExpressionQueryType): ExpressionQuery {
  // Re-picking the type it already is should not wipe the settings that go with it.
  if (query.type === type) {
    return query;
  }

  return makeExpression(type, query, getExpressionInput(query));
}
