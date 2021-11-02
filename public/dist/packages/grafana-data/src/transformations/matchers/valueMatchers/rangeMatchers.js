import { FieldType } from '../../../types/dataFrame';
import { ValueMatcherID } from '../ids';
var isBetweenValueMatcher = {
    id: ValueMatcherID.between,
    name: 'Is between',
    description: 'Match when field value is between given option values.',
    get: function (options) {
        return function (valueIndex, field) {
            var value = field.values.get(valueIndex);
            if (isNaN(value)) {
                return false;
            }
            return value > options.from && value < options.to;
        };
    },
    getOptionsDisplayText: function (options) {
        return "Matches all rows where field value is between " + options.from + " and " + options.to + ".";
    },
    isApplicable: function (field) { return field.type === FieldType.number; },
    getDefaultOptions: function () { return ({ from: 0, to: 100 }); },
};
export var getRangeValueMatchers = function () { return [isBetweenValueMatcher]; };
//# sourceMappingURL=rangeMatchers.js.map