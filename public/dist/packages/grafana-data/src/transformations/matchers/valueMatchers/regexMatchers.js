import { ValueMatcherID } from '../ids';
var regexValueMatcher = {
    id: ValueMatcherID.regex,
    name: 'Regex',
    description: 'Match when field value is matching regex.',
    get: function (options) {
        var regex = new RegExp(options.value);
        return function (valueIndex, field) {
            var value = field.values.get(valueIndex);
            return regex.test(value);
        };
    },
    getOptionsDisplayText: function (options) {
        return "Matches all rows where field value is matching regex: " + options.value;
    },
    isApplicable: function () { return true; },
    getDefaultOptions: function () { return ({ value: '.*' }); },
};
export var getRegexValueMatcher = function () { return [regexValueMatcher]; };
//# sourceMappingURL=regexMatchers.js.map