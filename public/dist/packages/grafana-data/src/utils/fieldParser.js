import { FieldType } from '../types/dataFrame';
import { guessFieldTypeFromValue } from '../dataframe/processDataFrame';
export function makeFieldParser(value, field) {
    if (!field.type) {
        if (field.name === 'time' || field.name === 'Time') {
            field.type = FieldType.time;
        }
        else {
            field.type = guessFieldTypeFromValue(value);
        }
    }
    if (field.type === FieldType.number) {
        return function (value) {
            return parseFloat(value);
        };
    }
    // Will convert anything that starts with "T" to true
    if (field.type === FieldType.boolean) {
        return function (value) {
            return !(value[0] === 'F' || value[0] === 'f' || value[0] === '0');
        };
    }
    // Just pass the string back
    return function (value) { return value; };
}
//# sourceMappingURL=fieldParser.js.map