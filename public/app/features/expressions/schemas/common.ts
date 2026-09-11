import * as z from 'zod';

import { EvalFunction } from '../../alerting/state/alertDef';

/**
 * Shared pieces for the per-type expression schemas.
 *
 * Every expression type is described by three layers:
 *
 *   1. a *wire* schema  - what the backend actually accepts. Deliberately forgiving: extra fields
 *      are kept, and anything malformed falls back to a default rather than failing.
 *   2. a *codec*        - converts wire <-> in-memory and back. Shape and normalisation only.
 *   3. *save rules*     - the stricter checks we only want to run when the user saves.
 *
 * Keep the save rules out of the codec. Zod validates the in-memory side of a codec on the way in
 * as well as on the way out, so a `.refine()` attached to the codec would stop us from reading a
 * rule that is already saved and slightly wrong - which would mean a user could no longer open
 * their own alert rule.
 *
 * The shapes here mirror what `pkg/expr` accepts at runtime. There is a generated JSON schema at
 * `pkg/expr/query.types.json`, but it is built from a set of Go structs that the parser does not
 * actually use, and it disagrees with the parser in several places, so it is not a safe reference.
 */

/**
 * Drops the catch-all `[x: string]: unknown` that looseObject puts on the inferred type.
 *
 * We do want unknown fields kept at runtime, but we do not want the type to accept any field name:
 * without this, reading `query.conditions` off a math expression quietly comes back as `unknown`
 * instead of being the compile error that tells you to check the type first.
 */
export type KnownFields<T> = { [K in keyof T as string extends K ? never : K]: T[K] };

/**
 * Matches DataSourceRef, so an expression query stays usable anywhere a DataQuery is expected.
 */
const datasourceRefSchema = z.looseObject({
  type: z.string().optional(),
  uid: z.string().optional(),
  apiVersion: z.string().optional(),
});

/**
 * Fields every query carries, expression or not. Unknown keys are kept on purpose: saved models
 * carry things we do not model here (`intervalMs`, `maxDataPoints`, and similar) and dropping them
 * on save would quietly change the rule.
 */
export const queryBaseWire = {
  refId: z.string().catch(''),
  hide: z.boolean().optional(),
  queryType: z.string().optional(),
  datasource: datasourceRefSchema.nullish().catch(undefined),
};

export const queryBaseMemory = {
  refId: z.string(),
  hide: z.boolean().optional(),
  queryType: z.string().optional(),
  datasource: datasourceRefSchema.nullish(),
};

/**
 * Reducers accepted by a `reduce` expression. The backend lower-cases the value before looking it
 * up, so `MAX` works, but the set is smaller than the classic-condition one below and notably has
 * no `avg`.
 */
export const REDUCE_REDUCER_IDS = ['sum', 'mean', 'min', 'max', 'count', 'last', 'median'] as const;
export type ReduceReducerId = (typeof REDUCE_REDUCER_IDS)[number];

/**
 * Reducers accepted inside a classic condition. Overlaps with the `reduce` set but is not a
 * superset - this one has `avg` where `reduce` has `mean` - and the backend does not lower-case it,
 * so the casing here has to be exact.
 */
export const CLASSIC_REDUCER_IDS = [
  'avg',
  'min',
  'max',
  'sum',
  'count',
  'last',
  'median',
  'diff',
  'diff_abs',
  'percent_diff',
  'percent_diff_abs',
  'count_non_null',
] as const;
export type ClassicReducerId = (typeof CLASSIC_REDUCER_IDS)[number];

/** Threshold evaluators. `no_value` is missing on purpose - only classic conditions accept it. */
export const THRESHOLD_EVAL_FUNCTIONS = [
  EvalFunction.IsAbove,
  EvalFunction.IsBelow,
  EvalFunction.IsEqual,
  EvalFunction.IsNotEqual,
  EvalFunction.IsGreaterThanEqual,
  EvalFunction.IsLessThanEqual,
  EvalFunction.IsWithinRange,
  EvalFunction.IsOutsideRange,
  EvalFunction.IsWithinRangeIncluded,
  EvalFunction.IsOutsideRangeIncluded,
] as const;

export type ThresholdEvalFunction = (typeof THRESHOLD_EVAL_FUNCTIONS)[number];

/** Classic condition evaluators - the threshold set plus `no_value`. */
export const CLASSIC_EVAL_FUNCTIONS = [...THRESHOLD_EVAL_FUNCTIONS, EvalFunction.HasNoValue] as const;

/** Evaluators that need two parameters rather than one. */
export const RANGE_EVAL_FUNCTIONS: readonly EvalFunction[] = [
  EvalFunction.IsWithinRange,
  EvalFunction.IsOutsideRange,
  EvalFunction.IsWithinRangeIncluded,
  EvalFunction.IsOutsideRangeIncluded,
];

export function isRangeEvalFunction(fn: EvalFunction): boolean {
  return RANGE_EVAL_FUNCTIONS.includes(fn);
}

/**
 * Resample only supports a subset of the reducers at execution time. The parser accepts anything,
 * so passing `count` or `median` here parses fine and then fails when the rule runs.
 */
export const DOWNSAMPLER_IDS = ['sum', 'mean', 'min', 'max', 'last'] as const;
export type DownsamplerId = (typeof DOWNSAMPLER_IDS)[number];

export const UPSAMPLER_IDS = ['pad', 'backfilling', 'fillna'] as const;
export type UpsamplerId = (typeof UPSAMPLER_IDS)[number];

/**
 * `reduce` and `resample` both strip a leading `$` from the expression they reference, so `$A` and
 * `A` mean the same thing to them. `threshold` does not, and a `$A` there ends up looking for a
 * query literally named `$A`. We normalise on read so the rest of the app only ever sees a bare
 * refId.
 */
export function stripRefIdPrefix(value: string): string {
  return value.startsWith('$') ? value.slice(1) : value;
}

/** A non-empty list of evaluators, which is what z.enum needs. */
type EvalFunctionList = readonly [EvalFunction, ...EvalFunction[]];

/**
 * An evaluator, as carried by both threshold and classic conditions. `params` is a list of numbers
 * whose length depends on the evaluator - see the save rules for each type.
 */
export function evaluatorWire(functions: EvalFunctionList) {
  return z.looseObject({
    type: z.enum(functions).catch(EvalFunction.IsAbove),
    params: z.array(z.number()).catch([]),
  });
}

export function evaluatorMemory(functions: EvalFunctionList) {
  return z.looseObject({
    type: z.enum(functions),
    params: z.array(z.number()),
  });
}

export type Evaluator = KnownFields<z.infer<ReturnType<typeof evaluatorMemory>>>;

/**
 * Does this evaluator have enough parameters to run? Range evaluators need two, everything else
 * needs one. Extra parameters are ignored by the backend, so they are not an error.
 */
export function hasEnoughParams(evaluator: Evaluator): boolean {
  const needed = isRangeEvalFunction(evaluator.type) ? 2 : 1;
  return evaluator.params.length >= needed;
}
