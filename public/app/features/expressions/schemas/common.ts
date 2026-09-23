import * as z from 'zod';

import { EvalFunction } from '../../alerting/state/alertDef';

/**
 * Shared pieces for the per-type expression schemas. Each type gets three things:
 *
 *   - a schema for the saved JSON, which forgives anything malformed so a rule always opens
 *   - a codec, which reads that JSON in and writes it back out
 *   - save rules, the stricter checks that only run when someone saves
 *
 * Keep the save rules separate from the codec. Zod runs a codec's checks when reading as well as
 * writing, so a `.refine()` on the codec would stop an already-saved rule from opening at all.
 *
 * These shapes follow what `pkg/expr` really accepts. Do not use
 * `pkg/expr/query.types.json` as a reference - it is generated from Go structs the parser does not
 * use, and it disagrees with the parser in several places.
 */

/**
 * `looseObject` lets the type accept any field name. We still want to keep unknown fields when
 * reading and writing, but with that in place asking a math expression for `conditions` gives you
 * `unknown` instead of the error you want. This drops it from the type only.
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
 * Reducers a `reduce` expression accepts. The backend lower-cases these, so `MAX` is fine. Note
 * there is no `avg` here - the average is called `mean`.
 */
export const REDUCE_REDUCER_IDS = ['sum', 'mean', 'min', 'max', 'count', 'last', 'median'] as const;
export type ReduceReducerId = (typeof REDUCE_REDUCER_IDS)[number];

/**
 * Reducers a classic condition accepts. Overlaps with the `reduce` list above but is not the same:
 * the average is `avg` here and `mean` there. The backend does not lower-case these, so the
 * spelling has to match exactly.
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
 * The only downsamplers resample can actually do. It accepts any name when the rule is saved, and
 * only complains later, when a bucket holds more than one point and it has to combine them - so a
 * bad name here can sit unnoticed until the data lines up to expose it.
 */
export const DOWNSAMPLER_IDS = ['sum', 'mean', 'min', 'max', 'last'] as const;
export type DownsamplerId = (typeof DOWNSAMPLER_IDS)[number];

export const UPSAMPLER_IDS = ['pad', 'backfilling', 'fillna'] as const;
export type UpsamplerId = (typeof UPSAMPLER_IDS)[number];

/**
 * `reduce` and `resample` ignore a leading `$` on the query they read, so `$A` and `A` mean the
 * same to them. `threshold` does not, and would go looking for a query actually called `$A`. We
 * strip it on the way in so the rest of the app only sees plain names.
 */
export function stripRefIdPrefix(value: string): string {
  return value.startsWith('$') ? value.slice(1) : value;
}

/** At least one evaluator, which is what `z.enum` needs. */
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
