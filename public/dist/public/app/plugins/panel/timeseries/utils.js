import { __assign, __values } from "tslib";
import { ArrayVector, FieldType, getDisplayProcessor, isBooleanUnit, } from '@grafana/data';
import { LineInterpolation, StackingMode } from '@grafana/schema';
// This will return a set of frames with only graphable values included
export function prepareGraphableFields(series, theme) {
    var e_1, _a, e_2, _b;
    var _c, _d, _e, _f;
    if (!(series === null || series === void 0 ? void 0 : series.length)) {
        return { warn: 'No data in response' };
    }
    var copy;
    var hasTimeseries = false;
    var frames = [];
    try {
        for (var series_1 = __values(series), series_1_1 = series_1.next(); !series_1_1.done; series_1_1 = series_1.next()) {
            var frame = series_1_1.value;
            var isTimeseries = false;
            var changed = false;
            var fields = [];
            try {
                for (var _g = (e_2 = void 0, __values(frame.fields)), _h = _g.next(); !_h.done; _h = _g.next()) {
                    var field = _h.value;
                    switch (field.type) {
                        case FieldType.time:
                            isTimeseries = true;
                            hasTimeseries = true;
                            fields.push(field);
                            break;
                        case FieldType.number:
                            changed = true;
                            copy = __assign(__assign({}, field), { values: new ArrayVector(field.values.toArray().map(function (v) {
                                    if (!(Number.isFinite(v) || v == null)) {
                                        return null;
                                    }
                                    return v;
                                })) });
                            if (((_d = (_c = copy.config.custom) === null || _c === void 0 ? void 0 : _c.stacking) === null || _d === void 0 ? void 0 : _d.mode) === StackingMode.Percent) {
                                copy.config.unit = 'percentunit';
                                copy.display = getDisplayProcessor({ field: copy, theme: theme });
                            }
                            fields.push(copy);
                            break; // ok
                        case FieldType.boolean:
                            changed = true;
                            var custom = (_f = (_e = field.config) === null || _e === void 0 ? void 0 : _e.custom) !== null && _f !== void 0 ? _f : {};
                            var config = __assign(__assign({}, field.config), { max: 1, min: 0, custom: custom });
                            // smooth and linear do not make sense
                            if (custom.lineInterpolation !== LineInterpolation.StepBefore) {
                                custom.lineInterpolation = LineInterpolation.StepAfter;
                            }
                            copy = __assign(__assign({}, field), { config: config, type: FieldType.number, values: new ArrayVector(field.values.toArray().map(function (v) {
                                    if (v == null) {
                                        return v;
                                    }
                                    return Boolean(v) ? 1 : 0;
                                })) });
                            if (!isBooleanUnit(config.unit)) {
                                config.unit = 'bool';
                                copy.display = getDisplayProcessor({ field: copy, theme: theme });
                            }
                            fields.push(copy);
                            break;
                        default:
                            changed = true;
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_h && !_h.done && (_b = _g.return)) _b.call(_g);
                }
                finally { if (e_2) throw e_2.error; }
            }
            if (isTimeseries && fields.length > 1) {
                hasTimeseries = true;
                if (changed) {
                    frames.push(__assign(__assign({}, frame), { fields: fields }));
                }
                else {
                    frames.push(frame);
                }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (series_1_1 && !series_1_1.done && (_a = series_1.return)) _a.call(series_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    if (!hasTimeseries) {
        return { warn: 'Data does not have a time field', noTimeField: true };
    }
    if (!frames.length) {
        return { warn: 'No graphable fields' };
    }
    return { frames: frames };
}
//# sourceMappingURL=utils.js.map