import { ResourceDimensionMode } from '@grafana/schema';
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
    const mode = (_a = config.mode) !== null && _a !== void 0 ? _a : ResourceDimensionMode.Fixed;
    if (mode === ResourceDimensionMode.Fixed) {
        const v = getPublicOrAbsoluteUrl(config.fixed);
        return {
            isAssumed: !Boolean(v),
            fixed: v,
            value: () => v,
            get: (i) => v,
        };
    }
    const field = findField(frame, config.field);
    if (!field) {
        const v = '';
        return {
            isAssumed: true,
            fixed: v,
            value: () => v,
            get: (i) => v,
        };
    }
    if (mode === ResourceDimensionMode.Mapping) {
        const mapper = (v) => getPublicOrAbsoluteUrl(`${v}`);
        return {
            field,
            get: (i) => mapper(field.values[i]),
            value: () => mapper(getLastNotNullFieldValue(field)),
        };
    }
    // mode === ResourceDimensionMode.Field case
    const getIcon = (value) => {
        if (field && field.display) {
            const icon = field.display(value).icon;
            return getPublicOrAbsoluteUrl(icon !== null && icon !== void 0 ? icon : '');
        }
        return '';
    };
    return {
        field,
        get: (index) => getIcon(field.values[index]),
        value: () => getIcon(getLastNotNullFieldValue(field)),
    };
}
//# sourceMappingURL=resource.js.map