import { ScalarDimensionMode } from '@grafana/schema';
import { findField, getLastNotNullFieldValue } from './utils';
//---------------------------------------------------------
// Scalar dimension
//---------------------------------------------------------
export function getScalarDimension(frame, config) {
    return getScalarDimensionForField(findField(frame, config === null || config === void 0 ? void 0 : config.field), config);
}
export function getScalarDimensionForField(field, cfg) {
    var _a, _b;
    if (!field) {
        const v = (_a = cfg.fixed) !== null && _a !== void 0 ? _a : 0;
        return {
            isAssumed: Boolean((_b = cfg.field) === null || _b === void 0 ? void 0 : _b.length) || !cfg.fixed,
            fixed: v,
            value: () => v,
            get: () => v,
        };
    }
    //mod mode as default
    let validated = (value) => {
        return value % cfg.max;
    };
    //capped mode
    if (cfg.mode === ScalarDimensionMode.Clamped) {
        validated = (value) => {
            if (value < cfg.min) {
                return cfg.min;
            }
            if (value > cfg.max) {
                return cfg.max;
            }
            return value;
        };
    }
    const get = (i) => {
        const v = field.values[i];
        if (v === null || typeof v !== 'number') {
            return 0;
        }
        return validated(v);
    };
    return {
        field,
        get,
        value: () => getLastNotNullFieldValue(field),
    };
}
//# sourceMappingURL=scalar.js.map