import { __assign, __values } from "tslib";
import { FieldType, getFieldDisplayName } from '@grafana/data';
export var DimensionError;
(function (DimensionError) {
    DimensionError[DimensionError["NoData"] = 0] = "NoData";
    DimensionError[DimensionError["BadFrameSelection"] = 1] = "BadFrameSelection";
    DimensionError[DimensionError["XNotFound"] = 2] = "XNotFound";
})(DimensionError || (DimensionError = {}));
export function isGraphable(field) {
    return field.type === FieldType.number;
}
export function getXYDimensions(cfg, data) {
    var e_1, _a;
    var _b;
    if (!data || !data.length) {
        return { error: DimensionError.NoData };
    }
    if (!cfg) {
        cfg = {
            frame: 0,
        };
    }
    var frame = data[(_b = cfg.frame) !== null && _b !== void 0 ? _b : 0];
    if (!frame) {
        return { error: DimensionError.BadFrameSelection };
    }
    var xIndex = -1;
    for (var i = 0; i < frame.fields.length; i++) {
        var f = frame.fields[i];
        if (cfg.x && cfg.x === getFieldDisplayName(f, frame, data)) {
            xIndex = i;
            break;
        }
        if (isGraphable(f) && !cfg.x) {
            xIndex = i;
            break;
        }
    }
    var hasTime = false;
    var x = frame.fields[xIndex];
    var fields = [x];
    try {
        for (var _c = __values(frame.fields), _d = _c.next(); !_d.done; _d = _c.next()) {
            var f = _d.value;
            if (f.type === FieldType.time) {
                hasTime = true;
            }
            if (f === x || !isGraphable(f)) {
                continue;
            }
            if (cfg.exclude) {
                var name_1 = getFieldDisplayName(f, frame, data);
                if (cfg.exclude.includes(name_1)) {
                    continue;
                }
            }
            fields.push(f);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return {
        x: x,
        fields: {
            x: getSimpleFieldMatcher(x),
            y: getSimpleFieldNotMatcher(x), // Not x
        },
        frame: __assign(__assign({}, frame), { fields: fields }),
        hasData: frame.fields.length > 0,
        hasTime: hasTime,
    };
}
function getSimpleFieldMatcher(f) {
    if (!f) {
        return function () { return false; };
    }
    // the field may change if sorted
    return function (field) { return f === field || !!(f.state && f.state === field.state); };
}
function getSimpleFieldNotMatcher(f) {
    if (!f) {
        return function () { return false; };
    }
    var m = getSimpleFieldMatcher(f);
    return function (field) { return !m(field, undefined, undefined); };
}
//# sourceMappingURL=dims.js.map