import { FieldType } from '../../../types/dataFrame';
import { ValueMatcherID } from '../ids';
var isGreaterValueMatcher = {
    id: ValueMatcherID.greater,
    name: 'Is greater',
    description: 'Match when field value is greater than option.',
    get: function (options) {
        return function (valueIndex, field) {
            var value = field.values.get(valueIndex);
            if (isNaN(value)) {
                return false;
            }
            return value > options.value;
        };
    },
    getOptionsDisplayText: function (options) {
        return "Matches all rows where field value is greater than: " + options.value + ".";
    },
    isApplicable: function (field) { return field.type === FieldType.number; },
    getDefaultOptions: function () { return ({ value: 0 }); },
};
var isGreaterOrEqualValueMatcher = {
    id: ValueMatcherID.greaterOrEqual,
    name: 'Is greater or equal',
    description: 'Match when field value is lower or greater than option.',
    get: function (options) {
        return function (valueIndex, field) {
            var value = field.values.get(valueIndex);
            if (isNaN(value)) {
                return false;
            }
            return value >= options.value;
        };
    },
    getOptionsDisplayText: function (options) {
        return "Matches all rows where field value is lower or greater than: " + options.value + ".";
    },
    isApplicable: function (field) { return field.type === FieldType.number; },
    getDefaultOptions: function () { return ({ value: 0 }); },
};
var isLowerValueMatcher = {
    id: ValueMatcherID.lower,
    name: 'Is lower',
    description: 'Match when field value is lower than option.',
    get: function (options) {
        return function (valueIndex, field) {
            var value = field.values.get(valueIndex);
            if (isNaN(value)) {
                return false;
            }
            return value < options.value;
        };
    },
    getOptionsDisplayText: function (options) {
        return "Matches all rows where field value is lower than: " + options.value + ".";
    },
    isApplicable: function (field) { return field.type === FieldType.number; },
    getDefaultOptions: function () { return ({ value: 0 }); },
};
var isLowerOrEqualValueMatcher = {
    id: ValueMatcherID.lowerOrEqual,
    name: 'Is lower or equal',
    description: 'Match when field value is lower or equal than option.',
    get: function (options) {
        return function (valueIndex, field) {
            var value = field.values.get(valueIndex);
            if (isNaN(value)) {
                return false;
            }
            return value <= options.value;
        };
    },
    getOptionsDisplayText: function (options) {
        return "Matches all rows where field value is lower or equal than: " + options.value + ".";
    },
    isApplicable: function (field) { return field.type === FieldType.number; },
    getDefaultOptions: function () { return ({ value: 0 }); },
};
export var getNumericValueMatchers = function () { return [
    isGreaterValueMatcher,
    isGreaterOrEqualValueMatcher,
    isLowerValueMatcher,
    isLowerOrEqualValueMatcher,
]; };
//# sourceMappingURL=numericMatchers.js.map