import { FieldType, getFieldDisplayName } from '@grafana/data';
// TODO: fix import
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
    var _a;
    if (!data || !data.length) {
        return { error: DimensionError.NoData };
    }
    if (!cfg) {
        cfg = {
            frame: 0,
        };
    }
    let frame = data[(_a = cfg.frame) !== null && _a !== void 0 ? _a : 0];
    if (!frame) {
        return { error: DimensionError.BadFrameSelection };
    }
    let xIndex = -1;
    for (let i = 0; i < frame.fields.length; i++) {
        const f = frame.fields[i];
        if (cfg.x && cfg.x === getFieldDisplayName(f, frame, data)) {
            xIndex = i;
            break;
        }
        if (isGraphable(f) && !cfg.x) {
            xIndex = i;
            break;
        }
    }
    let hasTime = false;
    const x = frame.fields[xIndex];
    const fields = [x];
    for (const f of frame.fields) {
        if (f.type === FieldType.time) {
            hasTime = true;
        }
        if (f === x || !isGraphable(f)) {
            continue;
        }
        if (cfg.exclude) {
            const name = getFieldDisplayName(f, frame, data);
            if (cfg.exclude.includes(name)) {
                continue;
            }
        }
        fields.push(f);
    }
    return {
        x,
        fields: {
            x: getSimpleFieldMatcher(x),
            y: getSimpleFieldNotMatcher(x), // Not x
        },
        frame: Object.assign(Object.assign({}, frame), { fields }),
        hasData: frame.fields.length > 0,
        hasTime,
    };
}
function getSimpleFieldMatcher(f) {
    if (!f) {
        return () => false;
    }
    // the field may change if sorted
    return (field) => f === field || !!(f.state && f.state === field.state);
}
function getSimpleFieldNotMatcher(f) {
    if (!f) {
        return () => false;
    }
    const m = getSimpleFieldMatcher(f);
    return (field) => !m(field, undefined, undefined);
}
//# sourceMappingURL=dims.js.map