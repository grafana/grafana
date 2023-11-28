import { FieldType, formattedValueToString } from '@grafana/data';
import { TextDimensionMode } from '@grafana/schema';
import { findField, getLastNotNullFieldValue } from './utils';
//---------------------------------------------------------
// Resource dimension
//---------------------------------------------------------
export function getTextDimension(frame, config) {
    const field = config.field ? findField(frame, config.field) : frame === null || frame === void 0 ? void 0 : frame.fields.find((f) => f.type === FieldType.string);
    return getTextDimensionForField(field, config);
}
export function getTextDimensionForField(field, config) {
    var _a;
    let v = config.fixed;
    const mode = (_a = config.mode) !== null && _a !== void 0 ? _a : TextDimensionMode.Fixed;
    if (mode === TextDimensionMode.Fixed) {
        return {
            isAssumed: !Boolean(v),
            fixed: v,
            value: () => v,
            get: (i) => v,
        };
    }
    if (mode === TextDimensionMode.Template) {
        const disp = (v) => {
            return `TEMPLATE[${config.fixed} // ${v}]`;
        };
        if (!field) {
            v = disp('');
            return {
                isAssumed: true,
                fixed: v,
                value: () => v,
                get: (i) => v,
            };
        }
        return {
            field,
            get: (i) => disp(field.values[i]),
            value: () => disp(getLastNotNullFieldValue(field)),
        };
    }
    if (!field) {
        return {
            isAssumed: true,
            fixed: v,
            value: () => v,
            get: (i) => v,
        };
    }
    let disp = (v) => formattedValueToString(field.display(v));
    return {
        field,
        get: (i) => disp(field.values[i]),
        value: () => disp(getLastNotNullFieldValue(field)),
    };
}
//# sourceMappingURL=text.js.map