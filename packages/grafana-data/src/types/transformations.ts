import { DataFrame, Field } from './dataFrame';
import { RegistryItemWithOptions } from '../utils/Registry';

/**
 * Function that transform data frames (AKA transformer)
 */
export type DataTransformer = (data: DataFrame[]) => DataFrame[];

export interface DataTransformerInfo<TOptions = any> extends RegistryItemWithOptions {
  /**
   * Function that configures transformation and returns a transformer
   * @param options
   */
  transformer: (options: TOptions) => DataTransformer;
}

export interface DataTransformerConfig<TOptions = any> {
  /**
   * Unique identifier of transformer
   */
  id: string;
  /**
   * Options to be passed to the transformer
   */
  options: TOptions;
}

export type FieldMatcher = (field: Field, frame: DataFrame, allFrames: DataFrame[]) => boolean;
export type FrameMatcher = (frame: DataFrame) => boolean;

export interface FieldMatcherInfo<TOptions = any> extends RegistryItemWithOptions<TOptions> {
  get: (options: TOptions) => FieldMatcher;
}

export interface FrameMatcherInfo<TOptions = any> extends RegistryItemWithOptions<TOptions> {
  get: (options: TOptions) => FrameMatcher;
}

export interface MatcherConfig<TOptions = any> {
  id: string;
  options?: TOptions;
}
