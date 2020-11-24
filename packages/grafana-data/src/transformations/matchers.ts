// Load the Builtin matchers
import { getFieldPredicateMatchers, getFramePredicateMatchers } from './matchers/predicates';
import { getFieldNameMatchers, getFrameNameMatchers } from './matchers/nameMatcher';
import { getFieldTypeMatchers } from './matchers/fieldTypeMatcher';
import { getRefIdMatchers } from './matchers/refIdMatcher';
import {
  FieldMatcherInfo,
  MatcherConfig,
  FrameMatcherInfo,
  FieldMatcher,
  FrameMatcher,
} from '../types/transformations';
import { Registry } from '../utils/Registry';
import { getSimpleFieldMatchers } from './matchers/simpleFieldMatcher';

export const fieldMatchers = new Registry<FieldMatcherInfo>(() => {
  return [
    ...getFieldPredicateMatchers(), // Predicates
    ...getFieldTypeMatchers(), // by type
    ...getFieldNameMatchers(), // by name
    ...getSimpleFieldMatchers(), // first
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
  return info.get(config.options);
}

export function getFrameMatchers(config: MatcherConfig): FrameMatcher {
  const info = frameMatchers.get(config.id);
  return info.get(config.options);
}
