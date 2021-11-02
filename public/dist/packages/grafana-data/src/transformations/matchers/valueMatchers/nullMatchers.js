import { ValueMatcherID } from '../ids';
var isNullValueMatcher = {
    id: ValueMatcherID.isNull,
    name: 'Is null',
    description: 'Match where value for given field is null.',
    get: function () {
        return function (valueIndex, field) {
            var value = field.values.get(valueIndex);
            return value == null;
        };
    },
    getOptionsDisplayText: function () {
        return "Matches all rows where field is null.";
    },
    isApplicable: function () { return true; },
    getDefaultOptions: function () { return ({}); },
};
var isNotNullValueMatcher = {
    id: ValueMatcherID.isNotNull,
    name: 'Is not null',
    description: 'Match where value for given field is not null.',
    get: function () {
        return function (valueIndex, field) {
            var value = field.values.get(valueIndex);
            return value != null;
        };
    },
    getOptionsDisplayText: function () {
        return "Matches all rows where field is not null.";
    },
    isApplicable: function () { return true; },
    getDefaultOptions: function () { return ({}); },
};
export var getNullValueMatchers = function () { return [isNullValueMatcher, isNotNullValueMatcher]; };
//# sourceMappingURL=nullMatchers.js.map