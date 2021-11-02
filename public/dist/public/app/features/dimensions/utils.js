import { __values } from "tslib";
import { getFieldDisplayName, ReducerID } from '@grafana/data';
import { getColorDimension, getScaledDimension, getTextDimension, getResourceDimension, } from 'app/features/dimensions';
import { config } from '@grafana/runtime';
export function getColorDimensionFromData(data, cfg) {
    var e_1, _a;
    if ((data === null || data === void 0 ? void 0 : data.series) && cfg.field) {
        try {
            for (var _b = __values(data.series), _c = _b.next(); !_c.done; _c = _b.next()) {
                var frame = _c.value;
                var d = getColorDimension(frame, cfg, config.theme2);
                if (!d.isAssumed || data.series.length === 1) {
                    return d;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    return getColorDimension(undefined, cfg, config.theme2);
}
export function getScaleDimensionFromData(data, cfg) {
    var e_2, _a;
    if ((data === null || data === void 0 ? void 0 : data.series) && cfg.field) {
        try {
            for (var _b = __values(data.series), _c = _b.next(); !_c.done; _c = _b.next()) {
                var frame = _c.value;
                var d = getScaledDimension(frame, cfg);
                if (!d.isAssumed || data.series.length === 1) {
                    return d;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
    }
    return getScaledDimension(undefined, cfg);
}
export function getResourceDimensionFromData(data, cfg) {
    var e_3, _a;
    if ((data === null || data === void 0 ? void 0 : data.series) && cfg.field) {
        try {
            for (var _b = __values(data.series), _c = _b.next(); !_c.done; _c = _b.next()) {
                var frame = _c.value;
                var d = getResourceDimension(frame, cfg);
                if (!d.isAssumed || data.series.length === 1) {
                    return d;
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_3) throw e_3.error; }
        }
    }
    return getResourceDimension(undefined, cfg);
}
export function getTextDimensionFromData(data, cfg) {
    var e_4, _a;
    if ((data === null || data === void 0 ? void 0 : data.series) && cfg.field) {
        try {
            for (var _b = __values(data.series), _c = _b.next(); !_c.done; _c = _b.next()) {
                var frame = _c.value;
                var d = getTextDimension(frame, cfg);
                if (!d.isAssumed || data.series.length === 1) {
                    return d;
                }
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_4) throw e_4.error; }
        }
    }
    return getTextDimension(undefined, cfg);
}
export function findField(frame, name) {
    var e_5, _a;
    if (!frame || !(name === null || name === void 0 ? void 0 : name.length)) {
        return undefined;
    }
    try {
        for (var _b = __values(frame.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
            var field = _c.value;
            if (name === field.name) {
                return field;
            }
            var disp = getFieldDisplayName(field, frame);
            if (name === disp) {
                return field;
            }
        }
    }
    catch (e_5_1) { e_5 = { error: e_5_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_5) throw e_5.error; }
    }
    return undefined;
}
export function findFieldIndex(frame, name) {
    if (!frame || !(name === null || name === void 0 ? void 0 : name.length)) {
        return undefined;
    }
    for (var i = 0; i < frame.fields.length; i++) {
        var field = frame.fields[i];
        if (name === field.name) {
            return i;
        }
        var disp = getFieldDisplayName(field, frame);
        if (name === disp) {
            return i;
        }
    }
    return undefined;
}
export function getLastNotNullFieldValue(field) {
    var _a;
    var calcs = (_a = field.state) === null || _a === void 0 ? void 0 : _a.calcs;
    if (calcs) {
        var v = calcs[ReducerID.lastNotNull];
        if (v != null) {
            return v;
        }
    }
    var data = field.values;
    var idx = data.length - 1;
    while (idx >= 0) {
        var v = data.get(idx--);
        if (v != null) {
            return v;
        }
    }
    return undefined;
}
//# sourceMappingURL=utils.js.map