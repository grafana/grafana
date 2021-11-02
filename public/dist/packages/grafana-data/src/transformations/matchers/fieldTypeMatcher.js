import { FieldType } from '../../types/dataFrame';
import { FieldMatcherID } from './ids';
// General Field matcher
var fieldTypeMatcher = {
    id: FieldMatcherID.byType,
    name: 'Field Type',
    description: 'match based on the field type',
    defaultOptions: FieldType.number,
    get: function (type) {
        return function (field, frame, allFrames) {
            return type === field.type;
        };
    },
    getOptionsDisplayText: function (type) {
        return "Field type: " + type;
    },
};
// Numeric Field matcher
// This gets its own entry so it shows up in the dropdown
var numericMatcher = {
    id: FieldMatcherID.numeric,
    name: 'Numeric Fields',
    description: 'Fields with type number',
    get: function () {
        return fieldTypeMatcher.get(FieldType.number);
    },
    getOptionsDisplayText: function () {
        return 'Numeric Fields';
    },
};
// Time Field matcher
var timeMatcher = {
    id: FieldMatcherID.time,
    name: 'Time Fields',
    description: 'Fields with type time',
    get: function () {
        return fieldTypeMatcher.get(FieldType.time);
    },
    getOptionsDisplayText: function () {
        return 'Time Fields';
    },
};
/**
 * Registry Initialization
 */
export function getFieldTypeMatchers() {
    return [fieldTypeMatcher, numericMatcher, timeMatcher];
}
//# sourceMappingURL=fieldTypeMatcher.js.map