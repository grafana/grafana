import { MonoTypeOperatorFunction } from 'rxjs';

import { RegistryItemWithOptions } from '../utils/Registry';

import { DataFrame, Field } from './dataFrame';
import { InterpolateFunction } from './panel';

/**
 * Context passed to transformDataFrame and to each transform operator
 */
export interface DataTransformContext {
  interpolate: InterpolateFunction;
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
}

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
 * @public
 */
export interface DataTransformerConfig<TOptions = any> {
  /**
   * Unique identifier of transformer
   */
  id: string;
  /**
   * Disabled transformations are skipped
   */
  disabled?: boolean;
  /**
   * Options to be passed to the transformer
   */
  options: TOptions;
}

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
export interface MatcherConfig<TOptions = any> {
  id: string;
  options?: TOptions;
}

/**
 * @public
 */
export enum SpecialValue {
  True = 'true',
  False = 'false',
  Null = 'null',
  Empty = 'empty',
}
