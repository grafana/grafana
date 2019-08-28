import { Field, DataFrame } from '../../types/dataFrame';
import { Registry, RegistryItemWithOptions } from '../registry';

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

// Load the Buildtin matchers
import { getFieldPredicateMatchers, getFramePredicateMatchers } from './predicates';
import { getFieldNameMatchers, getFrameNameMatchers } from './nameMatcher';
import { getFieldTypeMatchers } from './fieldTypeMatcher';
import { getRefIdMatchers } from './refIdMatcher';

export const fieldMatchers = new Registry<FieldMatcherInfo>(() => {
  return [
    ...getFieldPredicateMatchers(), // Predicates
    ...getFieldTypeMatchers(), // by type
    ...getFieldNameMatchers(), // by name
  ];
});

export const frameMatchers = new Registry<FrameMatcherInfo>(() => {
  return [
    ...getFramePredicateMatchers(), // Predicates
    ...getFrameNameMatchers(), // by name
    ...getRefIdMatchers(), // by query refId
  ];
});

export function getFieldMatcher(config: MatcherConfig): FieldMatcher {
  const info = fieldMatchers.get(config.id);
  if (!info) {
    throw new Error('Unknown Matcher: ' + config.id);
  }
  return info.get(config.options);
}

export function getFrameMatchers(config: MatcherConfig): FrameMatcher {
  const info = frameMatchers.get(config.id);
  if (!info) {
    throw new Error('Unknown Matcher: ' + config.id);
  }
  return info.get(config.options);
}
