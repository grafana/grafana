import { __read, __spreadArray } from "tslib";
// Load the Builtin matchers
import { getFieldPredicateMatchers, getFramePredicateMatchers } from './matchers/predicates';
import { getFieldNameMatchers, getFrameNameMatchers } from './matchers/nameMatcher';
import { getFieldTypeMatchers } from './matchers/fieldTypeMatcher';
import { getRefIdMatchers } from './matchers/refIdMatcher';
import { Registry } from '../utils/Registry';
import { getNullValueMatchers } from './matchers/valueMatchers/nullMatchers';
import { getNumericValueMatchers } from './matchers/valueMatchers/numericMatchers';
import { getEqualValueMatchers } from './matchers/valueMatchers/equalMatchers';
import { getRangeValueMatchers } from './matchers/valueMatchers/rangeMatchers';
import { getSimpleFieldMatchers } from './matchers/simpleFieldMatcher';
import { getRegexValueMatcher } from './matchers/valueMatchers/regexMatchers';
/**
 * Registry that contains all of the built in field matchers.
 * @public
 */
export var fieldMatchers = new Registry(function () {
    return __spreadArray(__spreadArray(__spreadArray(__spreadArray([], __read(getFieldPredicateMatchers()), false), __read(getFieldTypeMatchers()), false), __read(getFieldNameMatchers()), false), __read(getSimpleFieldMatchers()), false);
});
/**
 * Registry that contains all of the built in frame matchers.
 * @public
 */
export var frameMatchers = new Registry(function () {
    return __spreadArray(__spreadArray(__spreadArray([], __read(getFramePredicateMatchers()), false), __read(getFrameNameMatchers()), false), __read(getRefIdMatchers()), false);
});
/**
 * Registry that contains all of the built in value matchers.
 * @public
 */
export var valueMatchers = new Registry(function () {
    return __spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], __read(getNullValueMatchers()), false), __read(getNumericValueMatchers()), false), __read(getEqualValueMatchers()), false), __read(getRangeValueMatchers()), false), __read(getRegexValueMatcher()), false);
});
/**
 * Resolves a field matcher from the registry for given config.
 * Will throw an error if matcher can not be resolved.
 * @public
 */
export function getFieldMatcher(config) {
    var info = fieldMatchers.get(config.id);
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
export function getFrameMatchers(config) {
    var info = frameMatchers.get(config.id);
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
export function getValueMatcher(config) {
    var info = valueMatchers.get(config.id);
    if (!info) {
        throw new Error('Unknown value matcher: ' + config.id);
    }
    return info.get(config.options);
}
//# sourceMappingURL=matchers.js.map