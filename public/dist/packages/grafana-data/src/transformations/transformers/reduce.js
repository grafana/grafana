import { __assign, __read, __spreadArray, __values } from "tslib";
import { map } from 'rxjs/operators';
import { DataTransformerID } from './ids';
import { fieldReducers, reduceField, ReducerID } from '../fieldReducer';
import { alwaysFieldMatcher, notTimeFieldMatcher } from '../matchers/predicates';
import { FieldType } from '../../types/dataFrame';
import { ArrayVector } from '../../vector/ArrayVector';
import { guessFieldTypeForField } from '../../dataframe/processDataFrame';
import { getFieldMatcher } from '../matchers';
import { getFieldDisplayName } from '../../field';
export var ReduceTransformerMode;
(function (ReduceTransformerMode) {
    ReduceTransformerMode["SeriesToRows"] = "seriesToRows";
    ReduceTransformerMode["ReduceFields"] = "reduceFields";
})(ReduceTransformerMode || (ReduceTransformerMode = {}));
export var reduceTransformer = {
    id: DataTransformerID.reduce,
    name: 'Reduce',
    description: 'Reduce all rows or data points to a single value using a function like max, min, mean or last',
    defaultOptions: {
        reducers: [ReducerID.max],
    },
    /**
     * Return a modified copy of the series.  If the transform is not or should not
     * be applied, just return the input series
     */
    operator: function (options) { return function (source) {
        return source.pipe(map(function (data) {
            var _a;
            if (!((_a = options === null || options === void 0 ? void 0 : options.reducers) === null || _a === void 0 ? void 0 : _a.length)) {
                return data; // nothing selected
            }
            var matcher = options.fields
                ? getFieldMatcher(options.fields)
                : options.includeTimeField && options.mode === ReduceTransformerMode.ReduceFields
                    ? alwaysFieldMatcher
                    : notTimeFieldMatcher;
            // Collapse all matching fields into a single row
            if (options.mode === ReduceTransformerMode.ReduceFields) {
                return reduceFields(data, matcher, options.reducers);
            }
            // Add a row for each series
            var res = reduceSeriesToRows(data, matcher, options.reducers, options.labelsToFields);
            return res ? [res] : [];
        }));
    }; },
};
/**
 * @internal only exported for testing
 */
export function reduceSeriesToRows(data, matcher, reducerId, labelsToFields) {
    var e_1, _a;
    var calculators = fieldReducers.list(reducerId);
    var reducers = calculators.map(function (c) { return c.id; });
    var processed = [];
    var distinctLabels = labelsToFields ? getDistinctLabelKeys(data) : [];
    var _loop_1 = function (series) {
        var e_2, _b, e_3, _c, e_4, _d, e_5, _e, e_6, _f;
        var source = series.fields.filter(function (f) { return matcher(f, series, data); });
        var size = source.length;
        var fields = [];
        var names = new ArrayVector(new Array(size));
        fields.push({
            name: 'Field',
            type: FieldType.string,
            values: names,
            config: {},
        });
        var labels = {};
        if (labelsToFields) {
            try {
                for (var distinctLabels_1 = (e_2 = void 0, __values(distinctLabels)), distinctLabels_1_1 = distinctLabels_1.next(); !distinctLabels_1_1.done; distinctLabels_1_1 = distinctLabels_1.next()) {
                    var key = distinctLabels_1_1.value;
                    labels[key] = new ArrayVector(new Array(size));
                    fields.push({
                        name: key,
                        type: FieldType.string,
                        values: labels[key],
                        config: {},
                    });
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (distinctLabels_1_1 && !distinctLabels_1_1.done && (_b = distinctLabels_1.return)) _b.call(distinctLabels_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
        var calcs = {};
        try {
            for (var calculators_1 = (e_3 = void 0, __values(calculators)), calculators_1_1 = calculators_1.next(); !calculators_1_1.done; calculators_1_1 = calculators_1.next()) {
                var info = calculators_1_1.value;
                calcs[info.id] = new ArrayVector(new Array(size));
                fields.push({
                    name: info.name,
                    type: FieldType.other,
                    values: calcs[info.id],
                    config: {},
                });
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (calculators_1_1 && !calculators_1_1.done && (_c = calculators_1.return)) _c.call(calculators_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
        for (var i = 0; i < source.length; i++) {
            var field = source[i];
            var results = reduceField({
                field: field,
                reducers: reducers,
            });
            if (labelsToFields) {
                names.buffer[i] = field.name;
                if (field.labels) {
                    try {
                        for (var _g = (e_4 = void 0, __values(Object.keys(field.labels))), _h = _g.next(); !_h.done; _h = _g.next()) {
                            var key = _h.value;
                            labels[key].set(i, field.labels[key]);
                        }
                    }
                    catch (e_4_1) { e_4 = { error: e_4_1 }; }
                    finally {
                        try {
                            if (_h && !_h.done && (_d = _g.return)) _d.call(_g);
                        }
                        finally { if (e_4) throw e_4.error; }
                    }
                }
            }
            else {
                names.buffer[i] = getFieldDisplayName(field, series, data);
            }
            try {
                for (var calculators_2 = (e_5 = void 0, __values(calculators)), calculators_2_1 = calculators_2.next(); !calculators_2_1.done; calculators_2_1 = calculators_2.next()) {
                    var info = calculators_2_1.value;
                    var v = results[info.id];
                    calcs[info.id].buffer[i] = v;
                }
            }
            catch (e_5_1) { e_5 = { error: e_5_1 }; }
            finally {
                try {
                    if (calculators_2_1 && !calculators_2_1.done && (_e = calculators_2.return)) _e.call(calculators_2);
                }
                finally { if (e_5) throw e_5.error; }
            }
        }
        try {
            // For reduced fields, we don't know the type until we see the value
            for (var fields_1 = (e_6 = void 0, __values(fields)), fields_1_1 = fields_1.next(); !fields_1_1.done; fields_1_1 = fields_1.next()) {
                var f = fields_1_1.value;
                if (f.type === FieldType.other) {
                    var t = guessFieldTypeForField(f);
                    if (t) {
                        f.type = t;
                    }
                }
            }
        }
        catch (e_6_1) { e_6 = { error: e_6_1 }; }
        finally {
            try {
                if (fields_1_1 && !fields_1_1.done && (_f = fields_1.return)) _f.call(fields_1);
            }
            finally { if (e_6) throw e_6.error; }
        }
        processed.push(__assign(__assign({}, series), { // Same properties, different fields
            fields: fields, length: size }));
    };
    try {
        for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
            var series = data_1_1.value;
            _loop_1(series);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return mergeResults(processed);
}
export function getDistinctLabelKeys(frames) {
    var e_7, _a, e_8, _b, e_9, _c;
    var keys = new Set();
    try {
        for (var frames_1 = __values(frames), frames_1_1 = frames_1.next(); !frames_1_1.done; frames_1_1 = frames_1.next()) {
            var frame = frames_1_1.value;
            try {
                for (var _d = (e_8 = void 0, __values(frame.fields)), _e = _d.next(); !_e.done; _e = _d.next()) {
                    var field = _e.value;
                    if (field.labels) {
                        try {
                            for (var _f = (e_9 = void 0, __values(Object.keys(field.labels))), _g = _f.next(); !_g.done; _g = _f.next()) {
                                var k = _g.value;
                                keys.add(k);
                            }
                        }
                        catch (e_9_1) { e_9 = { error: e_9_1 }; }
                        finally {
                            try {
                                if (_g && !_g.done && (_c = _f.return)) _c.call(_f);
                            }
                            finally { if (e_9) throw e_9.error; }
                        }
                    }
                }
            }
            catch (e_8_1) { e_8 = { error: e_8_1 }; }
            finally {
                try {
                    if (_e && !_e.done && (_b = _d.return)) _b.call(_d);
                }
                finally { if (e_8) throw e_8.error; }
            }
        }
    }
    catch (e_7_1) { e_7 = { error: e_7_1 }; }
    finally {
        try {
            if (frames_1_1 && !frames_1_1.done && (_a = frames_1.return)) _a.call(frames_1);
        }
        finally { if (e_7) throw e_7.error; }
    }
    return __spreadArray([], __read(keys), false);
}
/**
 * @internal only exported for testing
 */
export function mergeResults(data) {
    if (!(data === null || data === void 0 ? void 0 : data.length)) {
        return undefined;
    }
    var baseFrame = data[0];
    for (var seriesIndex = 1; seriesIndex < data.length; seriesIndex++) {
        var series = data[seriesIndex];
        for (var baseIndex = 0; baseIndex < baseFrame.fields.length; baseIndex++) {
            var baseField = baseFrame.fields[baseIndex];
            for (var fieldIndex = 0; fieldIndex < series.fields.length; fieldIndex++) {
                var field = series.fields[fieldIndex];
                var isFirstField = baseIndex === 0 && fieldIndex === 0;
                var isSameField = baseField.type === field.type && baseField.name === field.name;
                if (isFirstField || isSameField) {
                    var baseValues = baseField.values.toArray();
                    var values = field.values.toArray();
                    baseField.values.buffer = baseValues.concat(values);
                }
            }
        }
    }
    baseFrame.name = undefined;
    baseFrame.length = baseFrame.fields[0].values.length;
    return baseFrame;
}
/**
 * @internal -- only exported for testing
 */
export function reduceFields(data, matcher, reducerId) {
    var e_10, _a, e_11, _b, e_12, _c;
    var calculators = fieldReducers.list(reducerId);
    var reducers = calculators.map(function (c) { return c.id; });
    var processed = [];
    try {
        for (var data_2 = __values(data), data_2_1 = data_2.next(); !data_2_1.done; data_2_1 = data_2.next()) {
            var series = data_2_1.value;
            var fields = [];
            try {
                for (var _d = (e_11 = void 0, __values(series.fields)), _e = _d.next(); !_e.done; _e = _d.next()) {
                    var field = _e.value;
                    if (matcher(field, series, data)) {
                        var results = reduceField({
                            field: field,
                            reducers: reducers,
                        });
                        try {
                            for (var reducers_1 = (e_12 = void 0, __values(reducers)), reducers_1_1 = reducers_1.next(); !reducers_1_1.done; reducers_1_1 = reducers_1.next()) {
                                var reducer = reducers_1_1.value;
                                var value = results[reducer];
                                var copy = __assign(__assign({}, field), { values: new ArrayVector([value]) });
                                copy.state = undefined;
                                if (reducers.length > 1) {
                                    if (!copy.labels) {
                                        copy.labels = {};
                                    }
                                    copy.labels['reducer'] = fieldReducers.get(reducer).name;
                                }
                                fields.push(copy);
                            }
                        }
                        catch (e_12_1) { e_12 = { error: e_12_1 }; }
                        finally {
                            try {
                                if (reducers_1_1 && !reducers_1_1.done && (_c = reducers_1.return)) _c.call(reducers_1);
                            }
                            finally { if (e_12) throw e_12.error; }
                        }
                    }
                }
            }
            catch (e_11_1) { e_11 = { error: e_11_1 }; }
            finally {
                try {
                    if (_e && !_e.done && (_b = _d.return)) _b.call(_d);
                }
                finally { if (e_11) throw e_11.error; }
            }
            if (fields.length) {
                processed.push(__assign(__assign({}, series), { fields: fields, length: 1 }));
            }
        }
    }
    catch (e_10_1) { e_10 = { error: e_10_1 }; }
    finally {
        try {
            if (data_2_1 && !data_2_1.done && (_a = data_2.return)) _a.call(data_2);
        }
        finally { if (e_10) throw e_10.error; }
    }
    return processed;
}
//# sourceMappingURL=reduce.js.map