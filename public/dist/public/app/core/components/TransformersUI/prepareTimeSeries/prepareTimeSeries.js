import { __assign, __values } from "tslib";
import { DataFrameType, FieldType, DataTransformerID, outerJoinDataFrames, fieldMatchers, FieldMatcherID, MutableDataFrame, ArrayVector, } from '@grafana/data';
import { map } from 'rxjs/operators';
/**
 * There is currently an effort to figure out consistent names
 * for the various formats/types we produce and use.
 *
 * This transformer will eventually include the required metadata that can assert
 * a DataFrame[] is of a given type
 *
 * @internal -- TBD
 */
export var timeSeriesFormat;
(function (timeSeriesFormat) {
    timeSeriesFormat["TimeSeriesWide"] = "wide";
    timeSeriesFormat["TimeSeriesMany"] = "many";
    timeSeriesFormat["TimeSeriesLong"] = "long";
})(timeSeriesFormat || (timeSeriesFormat = {}));
/**
 * Convert to [][time,number]
 */
export function toTimeSeriesMany(data) {
    var e_1, _a, e_2, _b, e_3, _c, e_4, _d;
    if (!Array.isArray(data) || data.length === 0) {
        return data;
    }
    var result = [];
    try {
        for (var _e = __values(toTimeSeriesLong(data)), _f = _e.next(); !_f.done; _f = _e.next()) {
            var frame = _f.value;
            var timeField = frame.fields[0];
            if (!timeField || timeField.type !== FieldType.time) {
                continue;
            }
            var valueFields = [];
            var labelFields = [];
            try {
                for (var _g = (e_2 = void 0, __values(frame.fields)), _h = _g.next(); !_h.done; _h = _g.next()) {
                    var field = _h.value;
                    switch (field.type) {
                        case FieldType.number:
                        case FieldType.boolean:
                            valueFields.push(field);
                            break;
                        case FieldType.string:
                            labelFields.push(field);
                            break;
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
            try {
                for (var valueFields_1 = (e_3 = void 0, __values(valueFields)), valueFields_1_1 = valueFields_1.next(); !valueFields_1_1.done; valueFields_1_1 = valueFields_1.next()) {
                    var field = valueFields_1_1.value;
                    if (labelFields.length) {
                        var builders = new Map();
                        var _loop_1 = function (i) {
                            var e_5, _l;
                            var time = timeField.values.get(i);
                            var value = field.values.get(i);
                            if (value === undefined || time == null) {
                                return "continue";
                            }
                            var key = labelFields.map(function (f) { return f.values.get(i); }).join('/');
                            var builder = builders.get(key);
                            if (!builder) {
                                builder = {
                                    key: key,
                                    time: [],
                                    value: [],
                                    labels: {},
                                };
                                try {
                                    for (var labelFields_1 = (e_5 = void 0, __values(labelFields)), labelFields_1_1 = labelFields_1.next(); !labelFields_1_1.done; labelFields_1_1 = labelFields_1.next()) {
                                        var label = labelFields_1_1.value;
                                        builder.labels[label.name] = label.values.get(i);
                                    }
                                }
                                catch (e_5_1) { e_5 = { error: e_5_1 }; }
                                finally {
                                    try {
                                        if (labelFields_1_1 && !labelFields_1_1.done && (_l = labelFields_1.return)) _l.call(labelFields_1);
                                    }
                                    finally { if (e_5) throw e_5.error; }
                                }
                                builders.set(key, builder);
                            }
                            builder.time.push(time);
                            builder.value.push(value);
                        };
                        for (var i = 0; i < frame.length; i++) {
                            _loop_1(i);
                        }
                        try {
                            // Add a frame for each distinct value
                            for (var _j = (e_4 = void 0, __values(builders.values())), _k = _j.next(); !_k.done; _k = _j.next()) {
                                var b = _k.value;
                                result.push({
                                    name: frame.name,
                                    refId: frame.refId,
                                    meta: __assign(__assign({}, frame.meta), { type: DataFrameType.TimeSeriesMany }),
                                    fields: [
                                        __assign(__assign({}, timeField), { values: new ArrayVector(b.time) }),
                                        __assign(__assign({}, field), { values: new ArrayVector(b.value), labels: b.labels }),
                                    ],
                                    length: b.time.length,
                                });
                            }
                        }
                        catch (e_4_1) { e_4 = { error: e_4_1 }; }
                        finally {
                            try {
                                if (_k && !_k.done && (_d = _j.return)) _d.call(_j);
                            }
                            finally { if (e_4) throw e_4.error; }
                        }
                    }
                    else {
                        result.push({
                            name: frame.name,
                            refId: frame.refId,
                            meta: __assign(__assign({}, frame.meta), { type: DataFrameType.TimeSeriesMany }),
                            fields: [timeField, field],
                            length: frame.length,
                        });
                    }
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (valueFields_1_1 && !valueFields_1_1.done && (_c = valueFields_1.return)) _c.call(valueFields_1);
                }
                finally { if (e_3) throw e_3.error; }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_f && !_f.done && (_a = _e.return)) _a.call(_e);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return result;
}
export function toTimeSeriesLong(data) {
    var e_6, _a, e_7, _b, e_8, _c, e_9, _d, e_10, _e, e_11, _f, e_12, _g;
    if (!Array.isArray(data) || data.length === 0) {
        return data;
    }
    var result = [];
    try {
        for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
            var frame = data_1_1.value;
            var timeField = void 0;
            var uniqueValueNames = [];
            var uniqueValueNamesToType = {};
            var uniqueLabelKeys = {};
            var labelKeyToWideIndices = {};
            var uniqueFactorNamesToWideIndex = {};
            for (var fieldIndex = 0; fieldIndex < frame.fields.length; fieldIndex++) {
                var field = frame.fields[fieldIndex];
                switch (field.type) {
                    case FieldType.string:
                    case FieldType.boolean:
                        if (field.name in uniqueFactorNamesToWideIndex) {
                            // TODO error?
                        }
                        else {
                            uniqueFactorNamesToWideIndex[field.name] = fieldIndex;
                            uniqueLabelKeys[field.name] = true;
                        }
                        break;
                    case FieldType.time:
                        if (!timeField) {
                            timeField = field;
                            break;
                        }
                    default:
                        if (field.name in uniqueValueNamesToType) {
                            var type = uniqueValueNamesToType[field.name];
                            if (field.type !== type) {
                                // TODO error?
                                continue;
                            }
                        }
                        else {
                            uniqueValueNamesToType[field.name] = field.type;
                            uniqueValueNames.push(field.name);
                        }
                        var tKey = JSON.stringify(field.labels);
                        var wideIndices = labelKeyToWideIndices[tKey];
                        if (wideIndices !== undefined) {
                            wideIndices.push(fieldIndex);
                        }
                        else {
                            labelKeyToWideIndices[tKey] = [fieldIndex];
                        }
                        if (field.labels != null) {
                            for (var labelKey in field.labels) {
                                uniqueLabelKeys[labelKey] = true;
                            }
                        }
                }
            }
            if (!timeField) {
                continue;
            }
            var sortedTimeRowIndices = [];
            var sortedUniqueLabelKeys = [];
            var uniqueFactorNames = [];
            var uniqueFactorNamesWithWideIndices = [];
            for (var wideRowIndex = 0; wideRowIndex < frame.length; wideRowIndex++) {
                sortedTimeRowIndices.push({ time: timeField.values.get(wideRowIndex), wideRowIndex: wideRowIndex });
            }
            for (var labelKeys in labelKeyToWideIndices) {
                sortedUniqueLabelKeys.push(labelKeys);
            }
            for (var labelKey in uniqueLabelKeys) {
                uniqueFactorNames.push(labelKey);
            }
            for (var name_1 in uniqueFactorNamesToWideIndex) {
                uniqueFactorNamesWithWideIndices.push(name_1);
            }
            sortedTimeRowIndices.sort(function (a, b) { return a.time - b.time; });
            sortedUniqueLabelKeys.sort();
            uniqueFactorNames.sort();
            uniqueValueNames.sort();
            var longFrame = new MutableDataFrame(__assign(__assign({}, frame), { meta: __assign(__assign({}, frame.meta), { type: DataFrameType.TimeSeriesLong }), fields: [{ name: timeField.name, type: timeField.type }] }));
            try {
                for (var uniqueValueNames_1 = (e_7 = void 0, __values(uniqueValueNames)), uniqueValueNames_1_1 = uniqueValueNames_1.next(); !uniqueValueNames_1_1.done; uniqueValueNames_1_1 = uniqueValueNames_1.next()) {
                    var name_2 = uniqueValueNames_1_1.value;
                    longFrame.addField({ name: name_2, type: uniqueValueNamesToType[name_2] });
                }
            }
            catch (e_7_1) { e_7 = { error: e_7_1 }; }
            finally {
                try {
                    if (uniqueValueNames_1_1 && !uniqueValueNames_1_1.done && (_b = uniqueValueNames_1.return)) _b.call(uniqueValueNames_1);
                }
                finally { if (e_7) throw e_7.error; }
            }
            try {
                for (var uniqueFactorNames_1 = (e_8 = void 0, __values(uniqueFactorNames)), uniqueFactorNames_1_1 = uniqueFactorNames_1.next(); !uniqueFactorNames_1_1.done; uniqueFactorNames_1_1 = uniqueFactorNames_1.next()) {
                    var name_3 = uniqueFactorNames_1_1.value;
                    longFrame.addField({ name: name_3, type: FieldType.string });
                }
            }
            catch (e_8_1) { e_8 = { error: e_8_1 }; }
            finally {
                try {
                    if (uniqueFactorNames_1_1 && !uniqueFactorNames_1_1.done && (_c = uniqueFactorNames_1.return)) _c.call(uniqueFactorNames_1);
                }
                finally { if (e_8) throw e_8.error; }
            }
            try {
                for (var sortedTimeRowIndices_1 = (e_9 = void 0, __values(sortedTimeRowIndices)), sortedTimeRowIndices_1_1 = sortedTimeRowIndices_1.next(); !sortedTimeRowIndices_1_1.done; sortedTimeRowIndices_1_1 = sortedTimeRowIndices_1.next()) {
                    var timeWideRowIndex = sortedTimeRowIndices_1_1.value;
                    var time = timeWideRowIndex.time, wideRowIndex = timeWideRowIndex.wideRowIndex;
                    try {
                        for (var sortedUniqueLabelKeys_1 = (e_10 = void 0, __values(sortedUniqueLabelKeys)), sortedUniqueLabelKeys_1_1 = sortedUniqueLabelKeys_1.next(); !sortedUniqueLabelKeys_1_1.done; sortedUniqueLabelKeys_1_1 = sortedUniqueLabelKeys_1.next()) {
                            var labelKeys = sortedUniqueLabelKeys_1_1.value;
                            var rowValues = {};
                            try {
                                for (var uniqueFactorNamesWithWideIndices_1 = (e_11 = void 0, __values(uniqueFactorNamesWithWideIndices)), uniqueFactorNamesWithWideIndices_1_1 = uniqueFactorNamesWithWideIndices_1.next(); !uniqueFactorNamesWithWideIndices_1_1.done; uniqueFactorNamesWithWideIndices_1_1 = uniqueFactorNamesWithWideIndices_1.next()) {
                                    var name_4 = uniqueFactorNamesWithWideIndices_1_1.value;
                                    rowValues[name_4] = frame.fields[uniqueFactorNamesToWideIndex[name_4]].values.get(wideRowIndex);
                                }
                            }
                            catch (e_11_1) { e_11 = { error: e_11_1 }; }
                            finally {
                                try {
                                    if (uniqueFactorNamesWithWideIndices_1_1 && !uniqueFactorNamesWithWideIndices_1_1.done && (_f = uniqueFactorNamesWithWideIndices_1.return)) _f.call(uniqueFactorNamesWithWideIndices_1);
                                }
                                finally { if (e_11) throw e_11.error; }
                            }
                            var index = 0;
                            try {
                                for (var _h = (e_12 = void 0, __values(labelKeyToWideIndices[labelKeys])), _j = _h.next(); !_j.done; _j = _h.next()) {
                                    var wideFieldIndex = _j.value;
                                    var wideField = frame.fields[wideFieldIndex];
                                    if (index++ === 0 && wideField.labels != null) {
                                        for (var labelKey in wideField.labels) {
                                            rowValues[labelKey] = wideField.labels[labelKey];
                                        }
                                    }
                                    rowValues[wideField.name] = wideField.values.get(wideRowIndex);
                                }
                            }
                            catch (e_12_1) { e_12 = { error: e_12_1 }; }
                            finally {
                                try {
                                    if (_j && !_j.done && (_g = _h.return)) _g.call(_h);
                                }
                                finally { if (e_12) throw e_12.error; }
                            }
                            rowValues[timeField.name] = time;
                            longFrame.add(rowValues);
                        }
                    }
                    catch (e_10_1) { e_10 = { error: e_10_1 }; }
                    finally {
                        try {
                            if (sortedUniqueLabelKeys_1_1 && !sortedUniqueLabelKeys_1_1.done && (_e = sortedUniqueLabelKeys_1.return)) _e.call(sortedUniqueLabelKeys_1);
                        }
                        finally { if (e_10) throw e_10.error; }
                    }
                }
            }
            catch (e_9_1) { e_9 = { error: e_9_1 }; }
            finally {
                try {
                    if (sortedTimeRowIndices_1_1 && !sortedTimeRowIndices_1_1.done && (_d = sortedTimeRowIndices_1.return)) _d.call(sortedTimeRowIndices_1);
                }
                finally { if (e_9) throw e_9.error; }
            }
            result.push(longFrame);
        }
    }
    catch (e_6_1) { e_6 = { error: e_6_1 }; }
    finally {
        try {
            if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
        }
        finally { if (e_6) throw e_6.error; }
    }
    return result;
}
export var prepareTimeSeriesTransformer = {
    id: DataTransformerID.prepareTimeSeries,
    name: 'Prepare time series',
    description: "Will stretch data frames from the wide format into the long format. This is really helpful to be able to keep backwards compatibility for panels not supporting the new wide format.",
    defaultOptions: {},
    operator: function (options) { return function (source) {
        return source.pipe(map(function (data) { return prepareTimeSeriesTransformer.transformer(options)(data); }));
    }; },
    transformer: function (options) {
        var _a;
        var format = (_a = options === null || options === void 0 ? void 0 : options.format) !== null && _a !== void 0 ? _a : timeSeriesFormat.TimeSeriesWide;
        if (format === timeSeriesFormat.TimeSeriesMany) {
            return toTimeSeriesMany;
        }
        else if (format === timeSeriesFormat.TimeSeriesLong) {
            return toTimeSeriesLong;
        }
        return function (data) {
            // Join by the first frame
            var frame = outerJoinDataFrames({
                frames: data,
                joinBy: fieldMatchers.get(FieldMatcherID.firstTimeField).get({}),
                enforceSort: true,
                keepOriginIndices: true,
            });
            return frame ? [frame] : [];
        };
    },
};
//# sourceMappingURL=prepareTimeSeries.js.map