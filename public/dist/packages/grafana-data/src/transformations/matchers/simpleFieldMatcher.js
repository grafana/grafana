import { FieldType } from '../../types/dataFrame';
import { FieldMatcherID } from './ids';
var firstFieldMatcher = {
    id: FieldMatcherID.first,
    name: 'First Field',
    description: 'The first field in the frame',
    get: function (type) {
        return function (field, frame, allFrames) {
            return field === frame.fields[0];
        };
    },
    getOptionsDisplayText: function () {
        return "First field";
    },
};
var firstTimeFieldMatcher = {
    id: FieldMatcherID.firstTimeField,
    name: 'First time field',
    description: 'The first field of type time in a frame',
    get: function (type) {
        return function (field, frame, allFrames) {
            return field.type === FieldType.time && field === frame.fields.find(function (f) { return f.type === FieldType.time; });
        };
    },
    getOptionsDisplayText: function () {
        return "First time field";
    },
};
/**
 * Registry Initialization
 */
export function getSimpleFieldMatchers() {
    return [firstFieldMatcher, firstTimeFieldMatcher];
}
//# sourceMappingURL=simpleFieldMatcher.js.map