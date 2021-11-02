import { ScaleDimensionMode } from '.';
import { getMinMaxAndDelta } from '../../../../packages/grafana-data/src/field/scale';
import { findField, getLastNotNullFieldValue } from './utils';
//---------------------------------------------------------
// Scale dimension
//---------------------------------------------------------
export function getScaledDimension(frame, config) {
    return getScaledDimensionForField(findField(frame, config === null || config === void 0 ? void 0 : config.field), config);
}
export function getScaledDimensionForField(field, config, mode) {
    var _a, _b;
    if (!field) {
        var v_1 = (_a = config.fixed) !== null && _a !== void 0 ? _a : 0;
        return {
            isAssumed: Boolean((_b = config.field) === null || _b === void 0 ? void 0 : _b.length) || !config.fixed,
            fixed: v_1,
            value: function () { return v_1; },
            get: function () { return v_1; },
        };
    }
    var info = getMinMaxAndDelta(field);
    var delta = config.max - config.min;
    var values = field.values;
    if (values.length < 1 || delta <= 0 || info.delta <= 0) {
        return {
            fixed: config.min,
            value: function () { return config.min; },
            get: function () { return config.min; },
        };
    }
    var scaled = function (percent) { return config.min + percent * delta; };
    if (mode === ScaleDimensionMode.Quadratic) {
        var maxArea = Math.PI * Math.pow((config.max / 2), 2);
        var minArea_1 = Math.PI * Math.pow((config.min / 2), 2);
        var deltaArea_1 = maxArea - minArea_1;
        // quadratic scaling (px area)
        scaled = function (percent) {
            var area = minArea_1 + deltaArea_1 * percent;
            return Math.sqrt(area / Math.PI) * 2;
        };
    }
    var get = function (i) {
        var value = field.values.get(i);
        var percent = 0;
        if (value !== -Infinity) {
            percent = (value - info.min) / info.delta;
        }
        if (percent > 1) {
            percent = 1;
        }
        else if (percent < 0) {
            percent = 0;
        }
        return scaled(percent);
    };
    return {
        get: get,
        value: function () { return get(getLastNotNullFieldValue(field)); },
        field: field,
    };
}
// This will mutate options
export function validateScaleOptions(options) {
    if (!options) {
        options = { min: 0, max: 1 };
    }
    if (options.min == null) {
        options.min = 0;
    }
    if (options.max == null) {
        options.max = 1;
    }
    return options;
}
/** Mutates and will return a valid version */
export function validateScaleConfig(copy, options) {
    var _a = validateScaleOptions(options), min = _a.min, max = _a.max;
    if (!copy) {
        copy = {};
    }
    if (copy.max == null) {
        copy.max = max;
    }
    if (copy.min == null) {
        copy.min = min;
    }
    // Make sure the order is right
    if (copy.min > copy.max) {
        var tmp = copy.max;
        copy.max = copy.min;
        copy.min = tmp;
    }
    // Validate range
    if (copy.min < min) {
        copy.min = min;
    }
    if (copy.max > max) {
        copy.max = max;
    }
    if (copy.fixed == null) {
        copy.fixed = copy.min + (copy.max - copy.min) / 2.0;
    }
    // Make sure the field value is within the absolute range
    if (!copy.field) {
        if (copy.fixed > max) {
            copy.fixed = max;
        }
        else if (copy.fixed < min) {
            copy.fixed = min;
        }
    }
    return copy;
}
//# sourceMappingURL=scale.js.map