// Load the Builtin matchers
import { getFieldTypeMatchers } from './matchers/fieldTypeMatcher';
import { fieldValueMatcherInfo } from './matchers/fieldValueMatcher';
import {
  fieldMatchers,
  frameMatchers,
  getFieldMatcher,
  getFrameMatchers,
  getValueMatcher,
  valueMatchers,
} from './matchers/matcherRegistries';
import { getFieldNameMatchers, getFrameNameMatchers } from './matchers/nameMatcher';
import { getFieldPredicateMatchers, getFramePredicateMatchers } from './matchers/predicates';
import { getRefIdMatchers } from './matchers/refIdMatcher';
import { getSimpleFieldMatchers } from './matchers/simpleFieldMatcher';
import { getEqualValueMatchers } from './matchers/valueMatchers/equalMatchers';
import { getNullValueMatchers } from './matchers/valueMatchers/nullMatchers';
import { getNumericValueMatchers } from './matchers/valueMatchers/numericMatchers';
import { getRangeValueMatchers } from './matchers/valueMatchers/rangeMatchers';
import { getRegexValueMatcher } from './matchers/valueMatchers/regexMatchers';
import { getSubstringValueMatchers } from './matchers/valueMatchers/substringMatchers';

fieldMatchers.setInit(() => {
  return [
    ...getFieldPredicateMatchers(), // Predicates
    ...getFieldTypeMatchers(), // by type
    ...getFieldNameMatchers(), // by name
    ...getSimpleFieldMatchers(), // first
    fieldValueMatcherInfo, // reduce field (all null/zero)
  ];
});

frameMatchers.setInit(() => {
  return [
    ...getFramePredicateMatchers(), // Predicates
    ...getFrameNameMatchers(), // by name
    ...getRefIdMatchers(), // by query refId
  ];
});

valueMatchers.setInit(() => {
  return [
    ...getNullValueMatchers(),
    ...getNumericValueMatchers(),
    ...getEqualValueMatchers(),
    ...getSubstringValueMatchers(),
    ...getRangeValueMatchers(),
    ...getRegexValueMatcher(),
  ];
});

export { fieldMatchers, frameMatchers, valueMatchers, getFieldMatcher, getFrameMatchers, getValueMatcher };
