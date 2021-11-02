import { ResourceDimensionMode } from './types';
import { findField, getLastNotNullFieldValue } from './utils';
//---------------------------------------------------------
// Resource dimension
//---------------------------------------------------------
export function getPublicOrAbsoluteUrl(v) {
    if (!v) {
        return '';
    }
    return v.indexOf(':/') > 0 ? v : window.__grafana_public_path__ + v;
}
export function getResourceDimension(frame, config) {
    var _a;
    var mode = (_a = config.mode) !== null && _a !== void 0 ? _a : ResourceDimensionMode.Fixed;
    if (mode === ResourceDimensionMode.Fixed) {
        var v_1 = getPublicOrAbsoluteUrl(config.fixed);
        return {
            isAssumed: !Boolean(v_1),
            fixed: v_1,
            value: function () { return v_1; },
            get: function (i) { return v_1; },
        };
    }
    var field = findField(frame, config.field);
    if (!field) {
        var v_2 = '';
        return {
            isAssumed: true,
            fixed: v_2,
            value: function () { return v_2; },
            get: function (i) { return v_2; },
        };
    }
    if (mode === ResourceDimensionMode.Mapping) {
        var mapper_1 = function (v) { return getPublicOrAbsoluteUrl("" + v); };
        return {
            field: field,
            get: function (i) { return mapper_1(field.values.get(i)); },
            value: function () { return mapper_1(getLastNotNullFieldValue(field)); },
        };
    }
    return {
        field: field,
        get: field.values.get,
        value: function () { return getLastNotNullFieldValue(field); },
    };
}
//# sourceMappingURL=resource.js.map