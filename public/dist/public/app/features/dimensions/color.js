import { getFieldColorModeForField, getScaleCalculator } from '@grafana/data';
import { findField, getLastNotNullFieldValue } from './utils';
//---------------------------------------------------------
// Color dimension
//---------------------------------------------------------
export function getColorDimension(frame, config, theme) {
    return getColorDimensionForField(findField(frame, config.field), config, theme);
}
export function getColorDimensionForField(field, config, theme) {
    var _a, _b;
    if (!field) {
        var v_1 = (_a = theme.visualization.getColorByName(config.fixed)) !== null && _a !== void 0 ? _a : 'grey';
        return {
            isAssumed: Boolean((_b = config.field) === null || _b === void 0 ? void 0 : _b.length) || !config.fixed,
            fixed: v_1,
            value: function () { return v_1; },
            get: function (i) { return v_1; },
        };
    }
    var mode = getFieldColorModeForField(field);
    if (!mode.isByValue) {
        var fixed_1 = mode.getCalculator(field, theme)(0, 0);
        return {
            fixed: fixed_1,
            value: function () { return fixed_1; },
            get: function (i) { return fixed_1; },
            field: field,
        };
    }
    var scale = getScaleCalculator(field, theme);
    return {
        get: function (i) {
            var val = field.values.get(i);
            return scale(val).color;
        },
        field: field,
        value: function () { return scale(getLastNotNullFieldValue(field)).color; },
    };
}
//# sourceMappingURL=color.js.map