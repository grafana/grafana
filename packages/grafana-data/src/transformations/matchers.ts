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
  ValueMatcherInfo,
  ValueMatcher,
} from '../types/transformations';
import { Registry } from '../utils/Registry';
import { getNullValueMatchers } from './matchers/valueMatchers';

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

export const valueMatchers = new Registry<ValueMatcherInfo>(() => {
  return [...getNullValueMatchers()];
});

export function getFieldMatcher(config: MatcherConfig): FieldMatcher {
  const info = fieldMatchers.get(config.id);
  if (!info) {
    throw new Error('Unknown field matcher: ' + config.id);
  }
  return info.get(config.options);
}

export function getFrameMatchers(config: MatcherConfig): FrameMatcher {
  const info = frameMatchers.get(config.id);
  if (!info) {
    throw new Error('Unknown frame matcher: ' + config.id);
  }
  return info.get(config.options);
}

export function getValueMatcher(config: MatcherConfig): ValueMatcher {
  const info = valueMatchers.get(config.id);
  if (!info) {
    throw new Error('Unknown value matcher: ' + config.id);
  }
  return info.get(config.options);
}
