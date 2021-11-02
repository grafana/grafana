import { __assign } from "tslib";
import { isNumber } from 'lodash';
import { reduceField, ReducerID } from '../transformations/fieldReducer';
import { FieldType } from '../types';
import { getFieldColorModeForField } from './fieldColor';
import { getActiveThresholdForValue } from './thresholds';
export function getScaleCalculator(field, theme) {
    var _a, _b;
    if (field.type === FieldType.boolean) {
        return getBooleanScaleCalculator(field, theme);
    }
    var mode = getFieldColorModeForField(field);
    var getColor = mode.getCalculator(field, theme);
    var info = (_b = (_a = field.state) === null || _a === void 0 ? void 0 : _a.range) !== null && _b !== void 0 ? _b : getMinMaxAndDelta(field);
    return function (value) {
        var percent = 0;
        if (value !== -Infinity) {
            percent = (value - info.min) / info.delta;
            if (Number.isNaN(percent)) {
                percent = 0;
            }
        }
        var threshold = getActiveThresholdForValue(field, value, percent);
        return {
            percent: percent,
            threshold: threshold,
            color: getColor(value, percent, threshold),
        };
    };
}
function getBooleanScaleCalculator(field, theme) {
    var trueValue = {
        color: theme.visualization.getColorByName('green'),
        percent: 1,
        threshold: undefined,
    };
    var falseValue = {
        color: theme.visualization.getColorByName('red'),
        percent: 0,
        threshold: undefined,
    };
    var mode = getFieldColorModeForField(field);
    if (mode.isContinuous && mode.getColors) {
        var colors = mode.getColors(theme);
        trueValue.color = colors[colors.length - 1];
        falseValue.color = colors[0];
    }
    return function (value) {
        return Boolean(value) ? trueValue : falseValue;
    };
}
export function getMinMaxAndDelta(field) {
    if (field.type !== FieldType.number) {
        return { min: 0, max: 100, delta: 100 };
    }
    // Calculate min/max if required
    var min = field.config.min;
    var max = field.config.max;
    if (!isNumber(min) || !isNumber(max)) {
        if (field.values && field.values.length) {
            var stats = reduceField({ field: field, reducers: [ReducerID.min, ReducerID.max] });
            if (!isNumber(min)) {
                min = stats[ReducerID.min];
            }
            if (!isNumber(max)) {
                max = stats[ReducerID.max];
            }
        }
        else {
            min = 0;
            max = 100;
        }
    }
    return {
        min: min,
        max: max,
        delta: max - min,
    };
}
/**
 * @internal
 */
export function getFieldConfigWithMinMax(field, local) {
    var _a;
    var config = field.config;
    var min = config.min, max = config.max;
    if (isNumber(min) && isNumber(max)) {
        return config;
    }
    if (local || !((_a = field.state) === null || _a === void 0 ? void 0 : _a.range)) {
        return __assign(__assign({}, config), getMinMaxAndDelta(field));
    }
    return __assign(__assign({}, config), field.state.range);
}
//# sourceMappingURL=scale.js.map