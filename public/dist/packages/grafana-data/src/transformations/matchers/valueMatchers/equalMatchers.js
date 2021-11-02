import { ValueMatcherID } from '../ids';
var isEqualValueMatcher = {
    id: ValueMatcherID.equal,
    name: 'Is equal',
    description: 'Match where value for given field is equal to options value.',
    get: function (options) {
        return function (valueIndex, field) {
            var value = field.values.get(valueIndex);
            // eslint-disable-next-line eqeqeq
            return value == options.value;
        };
    },
    getOptionsDisplayText: function () {
        return "Matches all rows where field is null.";
    },
    isApplicable: function () { return true; },
    getDefaultOptions: function () { return ({ value: '' }); },
};
var isNotEqualValueMatcher = {
    id: ValueMatcherID.notEqual,
    name: 'Is not equal',
    description: 'Match where value for given field is not equal to options value.',
    get: function (options) {
        return function (valueIndex, field) {
            var value = field.values.get(valueIndex);
            // eslint-disable-next-line eqeqeq
            return value != options.value;
        };
    },
    getOptionsDisplayText: function () {
        return "Matches all rows where field is not null.";
    },
    isApplicable: function () { return true; },
    getDefaultOptions: function () { return ({ value: '' }); },
};
export var getEqualValueMatchers = function () { return [isEqualValueMatcher, isNotEqualValueMatcher]; };
//# sourceMappingURL=equalMatchers.js.map