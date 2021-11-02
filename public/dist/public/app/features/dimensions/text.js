import { FieldType, formattedValueToString } from '@grafana/data';
import { TextDimensionMode } from './types';
import { findField, getLastNotNullFieldValue } from './utils';
//---------------------------------------------------------
// Resource dimension
//---------------------------------------------------------
export function getTextDimension(frame, config) {
    var field = config.field ? findField(frame, config.field) : frame === null || frame === void 0 ? void 0 : frame.fields.find(function (f) { return f.type === FieldType.string; });
    return getTextDimensionForField(field, config);
}
export function getTextDimensionForField(field, config) {
    var _a;
    var v = config.fixed;
    var mode = (_a = config.mode) !== null && _a !== void 0 ? _a : TextDimensionMode.Fixed;
    if (mode === TextDimensionMode.Fixed) {
        return {
            isAssumed: !Boolean(v),
            fixed: v,
            value: function () { return v; },
            get: function (i) { return v; },
        };
    }
    if (mode === TextDimensionMode.Template) {
        var disp_1 = function (v) {
            return "TEMPLATE[" + config.fixed + " // " + v + "]";
        };
        if (!field) {
            v = disp_1('');
            return {
                isAssumed: true,
                fixed: v,
                value: function () { return v; },
                get: function (i) { return v; },
            };
        }
        return {
            field: field,
            get: function (i) { return disp_1(field.values.get(i)); },
            value: function () { return disp_1(getLastNotNullFieldValue(field)); },
        };
    }
    if (!field) {
        return {
            isAssumed: true,
            fixed: v,
            value: function () { return v; },
            get: function (i) { return v; },
        };
    }
    var disp = function (v) { return formattedValueToString(field.display(v)); };
    return {
        field: field,
        get: function (i) { return disp(field.values.get(i)); },
        value: function () { return disp(getLastNotNullFieldValue(field)); },
    };
}
//# sourceMappingURL=text.js.map