import { isString, isUndefined } from 'lodash';
import { FieldType } from '@grafana/data';
export function convertToType(value, field) {
    switch (field.type) {
        case FieldType.boolean:
            if (isUndefined(value)) {
                return false;
            }
            return convertToBool(value);
        case FieldType.number:
            if (isNaN(value)) {
                return 0;
            }
            return parseFloat(value);
        case FieldType.string:
            if (!value) {
                return '';
            }
            return String(value);
        default:
            return value;
    }
}
const convertToBool = (value) => {
    if (isString(value)) {
        return !(value[0] === 'F' || value[0] === 'f' || value[0] === '0');
    }
    return !!value;
};
//# sourceMappingURL=utils.js.map