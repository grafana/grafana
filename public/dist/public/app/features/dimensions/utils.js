import { getFieldDisplayName, ReducerID } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getColorDimension, getScaledDimension, getTextDimension, getResourceDimension, } from 'app/features/dimensions';
import { getScalarDimension } from './scalar';
export function getColorDimensionFromData(data, cfg) {
    if ((data === null || data === void 0 ? void 0 : data.series) && cfg.field) {
        for (const frame of data.series) {
            const d = getColorDimension(frame, cfg, config.theme2);
            if (!d.isAssumed || data.series.length === 1) {
                return d;
            }
        }
    }
    return getColorDimension(undefined, cfg, config.theme2);
}
export function getScaleDimensionFromData(data, cfg) {
    if ((data === null || data === void 0 ? void 0 : data.series) && cfg.field) {
        for (const frame of data.series) {
            const d = getScaledDimension(frame, cfg);
            if (!d.isAssumed || data.series.length === 1) {
                return d;
            }
        }
    }
    return getScaledDimension(undefined, cfg);
}
export function getScalarDimensionFromData(data, cfg) {
    if ((data === null || data === void 0 ? void 0 : data.series) && cfg.field) {
        for (const frame of data.series) {
            const d = getScalarDimension(frame, cfg);
            if (!d.isAssumed || data.series.length === 1) {
                return d;
            }
        }
    }
    return getScalarDimension(undefined, cfg);
}
export function getResourceDimensionFromData(data, cfg) {
    if ((data === null || data === void 0 ? void 0 : data.series) && cfg.field) {
        for (const frame of data.series) {
            const d = getResourceDimension(frame, cfg);
            if (!d.isAssumed || data.series.length === 1) {
                return d;
            }
        }
    }
    return getResourceDimension(undefined, cfg);
}
export function getTextDimensionFromData(data, cfg) {
    if ((data === null || data === void 0 ? void 0 : data.series) && cfg.field) {
        for (const frame of data.series) {
            const d = getTextDimension(frame, cfg);
            if (!d.isAssumed || data.series.length === 1) {
                return d;
            }
        }
    }
    return getTextDimension(undefined, cfg);
}
export function findField(frame, name) {
    const idx = findFieldIndex(frame, name);
    return idx == null ? undefined : frame.fields[idx];
}
export function findFieldIndex(frame, name) {
    if (!frame || !(name === null || name === void 0 ? void 0 : name.length)) {
        return undefined;
    }
    for (let i = 0; i < frame.fields.length; i++) {
        const field = frame.fields[i];
        if (name === field.name) {
            return i;
        }
        const disp = getFieldDisplayName(field, frame);
        if (name === disp) {
            return i;
        }
    }
    return undefined;
}
export function getLastNotNullFieldValue(field) {
    var _a;
    const calcs = (_a = field.state) === null || _a === void 0 ? void 0 : _a.calcs;
    if (calcs) {
        const v = calcs[ReducerID.lastNotNull];
        if (v != null) {
            return v;
        }
    }
    const data = field.values;
    let idx = data.length - 1;
    while (idx >= 0) {
        const v = data[idx--];
        if (v != null) {
            return v;
        }
    }
    return undefined;
}
//# sourceMappingURL=utils.js.map