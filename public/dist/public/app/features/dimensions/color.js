import { getDisplayProcessor, getFieldColorModeForField, getFieldConfigWithMinMax, } from '@grafana/data';
import { findField, getLastNotNullFieldValue } from './utils';
//---------------------------------------------------------
// Color dimension
//---------------------------------------------------------
export function getColorDimension(frame, config, theme) {
    return getColorDimensionForField(findField(frame, config.field), config, theme);
}
export function getColorDimensionForField(field, config, theme) {
    var _a, _b, _c;
    if (!field) {
        const v = theme.visualization.getColorByName((_a = config.fixed) !== null && _a !== void 0 ? _a : 'grey');
        return {
            isAssumed: Boolean((_b = config.field) === null || _b === void 0 ? void 0 : _b.length) || !config.fixed,
            fixed: v,
            value: () => v,
            get: (i) => v,
        };
    }
    // Use the expensive color calculation by value
    const mode = getFieldColorModeForField(field);
    if (mode.isByValue || ((_c = field.config.mappings) === null || _c === void 0 ? void 0 : _c.length)) {
        // Force this to use local min/max for range
        const config = getFieldConfigWithMinMax(field, true);
        if (config !== field.config) {
            field = Object.assign(Object.assign({}, field), { config });
            field.state = undefined;
        }
        const disp = getDisplayProcessor({ field, theme });
        const getColor = (value) => {
            var _a;
            return (_a = disp(value).color) !== null && _a !== void 0 ? _a : '#ccc';
        };
        return {
            field,
            get: (index) => getColor(field.values[index]),
            value: () => getColor(getLastNotNullFieldValue(field)),
        };
    }
    // Typically series or fixed color (does not depend on value)
    const fixed = mode.getCalculator(field, theme)(0, 0);
    return {
        fixed,
        value: () => fixed,
        get: (i) => fixed,
        field,
    };
}
//# sourceMappingURL=color.js.map