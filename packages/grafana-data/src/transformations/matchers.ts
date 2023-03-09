// Load the Builtin matchers
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

import { getFieldTypeMatchers } from './matchers/fieldTypeMatcher';
import { fieldValueMatcherInfo } from './matchers/fieldValueMatcher';
import { getFieldNameMatchers, getFrameNameMatchers } from './matchers/nameMatcher';
import { getFieldPredicateMatchers, getFramePredicateMatchers } from './matchers/predicates';
import { getRefIdMatchers } from './matchers/refIdMatcher';
import { getSimpleFieldMatchers } from './matchers/simpleFieldMatcher';
import { getEqualValueMatchers } from './matchers/valueMatchers/equalMatchers';
import { getNullValueMatchers } from './matchers/valueMatchers/nullMatchers';
import { getNumericValueMatchers } from './matchers/valueMatchers/numericMatchers';
import { getRangeValueMatchers } from './matchers/valueMatchers/rangeMatchers';
import { getRegexValueMatcher } from './matchers/valueMatchers/regexMatchers';

export { type FieldValueMatcherConfig } from './matchers/fieldValueMatcher';

/**
 * Registry that contains all of the built in field matchers.
 * @public
 */
export const fieldMatchers = new Registry<FieldMatcherInfo>(() => {
  return [
    ...getFieldPredicateMatchers(), // Predicates
    ...getFieldTypeMatchers(), // by type
    ...getFieldNameMatchers(), // by name
    ...getSimpleFieldMatchers(), // first
    fieldValueMatcherInfo, // reduce field (all null/zero)
  ];
});

/**
 * Registry that contains all of the built in frame matchers.
 * @public
 */
export const frameMatchers = new Registry<FrameMatcherInfo>(() => {
  return [
    ...getFramePredicateMatchers(), // Predicates
    ...getFrameNameMatchers(), // by name
    ...getRefIdMatchers(), // by query refId
  ];
});

/**
 * Registry that contains all of the built in value matchers.
 * @public
 */
export const valueMatchers = new Registry<ValueMatcherInfo>(() => {
  return [
    ...getNullValueMatchers(),
    ...getNumericValueMatchers(),
    ...getEqualValueMatchers(),
    ...getRangeValueMatchers(),
    ...getRegexValueMatcher(),
  ];
});

/**
 * Resolves a field matcher from the registry for given config.
 * Will throw an error if matcher can not be resolved.
 * @public
 */
export function getFieldMatcher(config: MatcherConfig): FieldMatcher {
  const info = fieldMatchers.get(config.id);
  if (!info) {
    throw new Error('Unknown field matcher: ' + config.id);
  }
  return info.get(config.options);
}

/**
 * Resolves a frame matcher from the registry for given config.
 * Will throw an error if matcher can not be resolved.
 * @public
 */
export function getFrameMatchers(config: MatcherConfig): FrameMatcher {
  const info = frameMatchers.get(config.id);
  if (!info) {
    throw new Error('Unknown frame matcher: ' + config.id);
  }
  return info.get(config.options);
}

/**
 * Resolves a value matcher from the registry for given config.
 * Will throw an error if matcher can not be resolved.
 * @public
 */
export function getValueMatcher(config: MatcherConfig): ValueMatcher {
  const info = valueMatchers.get(config.id);
  if (!info) {
    throw new Error('Unknown value matcher: ' + config.id);
  }
  return info.get(config.options);
}
