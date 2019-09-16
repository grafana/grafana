import { DataFrame, Field } from './dataFrame';
import { RegistryItemWithOptions } from '../utils/Registry';

/**
 * Immutable data transformation
 */
export type DataTransformer = (data: DataFrame[]) => DataFrame[];

export interface DataTransformerInfo<TOptions = any> extends RegistryItemWithOptions {
  transformer: (options: TOptions) => DataTransformer;
}

export interface DataTransformerConfig<TOptions = any> {
  id: string;
  options: TOptions;
}

export type FieldMatcher = (field: Field) => boolean;
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
