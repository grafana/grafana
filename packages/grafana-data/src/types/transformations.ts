import { type MonoTypeOperatorFunction } from 'rxjs';

import { type MatcherConfig, type DataTransformerConfig } from '@grafana/schema';

import { type RegistryItemWithOptions } from '../utils/Registry';

import { type DataFrame, type Field } from './dataFrame';
import { type InterpolateFunction } from './panel';

/** deprecated, use it from schema */
export type { MatcherConfig };

/**
 * Context passed to transformDataFrame and to each transform operator
 */
export interface DataTransformContext {
  interpolate: InterpolateFunction;
}

/**
 * We score for how applicable a given transformation is.
 * Currently :
 *  0 is considered as not-applicable
 *  1 is considered applicable
 *  2 is considered as highly applicable (i.e. should be highlighted)
 */
export type TransformationApplicabilityScore = number;
export enum TransformationApplicabilityLevels {
  NotPossible = -1,
  NotApplicable = 0,
  Applicable = 1,
  HighlyApplicable = 2,
}

/**
 * Function that transform data frames (AKA transformer)
 *
 * @public
 */
export interface DataTransformerInfo<TOptions = any> extends RegistryItemWithOptions {
  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  operator: (options: TOptions, context: DataTransformContext) => MonoTypeOperatorFunction<DataFrame[]>;
  /**
   * Function that is present will indicate whether a transformation is applicable
   * given the current data.
   * @param options
   */
  isApplicable?: (data: DataFrame[]) => TransformationApplicabilityScore;
  /**
   * A description of the applicator. Can either simply be a string
   * or function which when given the current dataset returns a string.
   * This way descriptions can be tailored relative to the underlying data.
   */
  isApplicableDescription?: string | ((data: DataFrame[]) => string);
}

/**
 * Function that returns a cutsom transform operator for transforming data frames
 *
 * @public
 */
export type CustomTransformOperator = (context: DataTransformContext) => MonoTypeOperatorFunction<DataFrame[]>;

/**
 * Data handed to a {@link PanelDataTransformationsSupplier}.
 *
 * @alpha
 */
export interface PanelDataTransformationsContext {
  /** Query result frames, before user transformations and before field overrides */
  series: DataFrame[];
}

/**
 * Read-only transformations a panel requires, grouped by where each runs relative to the
 * transformations the user configured.
 *
 * @alpha
 */
export interface PanelDataTransformations {
  /**
   * Run before every user-configured transformation and before field overrides, so the fields
   * they produce are matchable by overrides and targetable by the user's own transformations.
   */
  prepend?: Array<DataTransformerConfig | CustomTransformOperator>;
  /** Run after every user-configured transformation, and only after all of them. */
  append?: Array<DataTransformerConfig | CustomTransformOperator>;
}

/**
 * Returns read-only transformations a dashboard panel requires in order to render its data.
 *
 * Registered via `PanelPlugin.setDataTransformations`. An array result is shorthand for
 * {@link PanelDataTransformations.prepend}.
 *
 * Called once per data update that carries frames, so it may branch on frame shape or `meta`. The
 * result is cached against that frames array and shared by both positions and by the
 * transformations editor, so keep the supplier cheap and free of side effects. Empty results pass
 * through without consulting the supplier.
 *
 * Only the series data topic is supported, in both positions: configs with `topic` set to
 * annotations or alert states are ignored.
 *
 * Option strings are mostly not interpolated — scenes skips these entries because they are carried
 * by a custom transform operator, and `transformDataFrame` skips its own pass while a scene is
 * registered. The exception is transformers that interpolate their own options through
 * `DataTransformContext.interpolate`, such as `formatTime` and `histogram`; those do see the
 * scene's interpolation.
 *
 * Reaches Grafana dashboards only. `PanelRenderer` runs no transformations, so Explore,
 * alerting rule previews and visualization suggestion cards render the untransformed query
 * result — as do scenes built outside dashboards, which construct their own transformer.
 *
 * @alpha
 */
export type PanelDataTransformationsSupplier = (
  ctx: PanelDataTransformationsContext
) => Array<DataTransformerConfig | CustomTransformOperator> | PanelDataTransformations | undefined;

/**
 * Many transformations can be called with a simple synchronous function.
 * When a transformer is defined, it should have identical behavior to using the operator
 *
 * @public
 */
export interface SynchronousDataTransformerInfo<TOptions = any> extends DataTransformerInfo<TOptions> {
  transformer: (options: TOptions, context: DataTransformContext) => (frames: DataFrame[]) => DataFrame[];
}

/**
 * @deprecated use TransformationConfig from schema
 */
export type { DataTransformerConfig };

export type FrameMatcher = (frame: DataFrame) => boolean;
export type FieldMatcher = (field: Field, frame: DataFrame, allFrames: DataFrame[]) => boolean;

/**
 * Value matcher type to describe the matcher function
 * @public
 */
export type ValueMatcher = (valueIndex: number, field: Field, frame: DataFrame, allFrames: DataFrame[]) => boolean;

export interface FieldMatcherInfo<TOptions = any> extends RegistryItemWithOptions<TOptions> {
  get: (options: TOptions) => FieldMatcher;
}

export interface FrameMatcherInfo<TOptions = any> extends RegistryItemWithOptions<TOptions> {
  get: (options: TOptions) => FrameMatcher;
}

/**
 * Registry item to represent all the different valu matchers supported
 * in the Grafana platform.
 * @public
 */
export interface ValueMatcherInfo<TOptions = any> extends RegistryItemWithOptions<TOptions> {
  get: (options: TOptions) => ValueMatcher;
  isApplicable: (field: Field) => boolean;
  getDefaultOptions: (field: Field) => TOptions;
}

/**
 * @public
 */
export enum SpecialValue {
  True = 'true',
  False = 'false',
  Null = 'null',
  Empty = 'empty',
  Zero = 'zero',
}
