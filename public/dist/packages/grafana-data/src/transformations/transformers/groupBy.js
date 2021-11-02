import { __assign, __values } from "tslib";
import { map } from 'rxjs/operators';
import { DataTransformerID } from './ids';
import { FieldType } from '../../types/dataFrame';
import { getFieldDisplayName } from '../../field/fieldState';
import { ArrayVector } from '../../vector/ArrayVector';
import { guessFieldTypeForField } from '../../dataframe/processDataFrame';
import { reduceField, ReducerID } from '../fieldReducer';
export var GroupByOperationID;
(function (GroupByOperationID) {
    GroupByOperationID["aggregate"] = "aggregate";
    GroupByOperationID["groupBy"] = "groupby";
})(GroupByOperationID || (GroupByOperationID = {}));
export var groupByTransformer = {
    id: DataTransformerID.groupBy,
    name: 'Group by',
    description: 'Group the data by a field values then process calculations for each group',
    defaultOptions: {
        fields: {},
    },
    /**
     * Return a modified copy of the series.  If the transform is not or should not
     * be applied, just return the input series
     */
    operator: function (options) { return function (source) {
        return source.pipe(map(function (data) {
            var e_1, _a, e_2, _b, e_3, _c, e_4, _d, e_5, _e, e_6, _f, e_7, _g, e_8, _h;
            var _j;
            var hasValidConfig = Object.keys(options.fields).find(function (name) { return options.fields[name].operation === GroupByOperationID.groupBy; });
            if (!hasValidConfig) {
                return data;
            }
            var processed = [];
            try {
                for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
                    var frame = data_1_1.value;
                    var groupByFields = [];
                    try {
                        for (var _k = (e_2 = void 0, __values(frame.fields)), _l = _k.next(); !_l.done; _l = _k.next()) {
                            var field = _l.value;
                            if (shouldGroupOnField(field, options)) {
                                groupByFields.push(field);
                            }
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_l && !_l.done && (_b = _k.return)) _b.call(_k);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                    if (groupByFields.length === 0) {
                        continue; // No group by field in this frame, ignore the frame
                    }
                    // Group the values by fields and groups so we can get all values for a
                    // group for a given field.
                    var valuesByGroupKey = {};
                    var _loop_1 = function (rowIndex) {
                        var e_9, _p;
                        var groupKey = String(groupByFields.map(function (field) { return field.values.get(rowIndex); }));
                        var valuesByField = (_j = valuesByGroupKey[groupKey]) !== null && _j !== void 0 ? _j : {};
                        if (!valuesByGroupKey[groupKey]) {
                            valuesByGroupKey[groupKey] = valuesByField;
                        }
                        try {
                            for (var _q = (e_9 = void 0, __values(frame.fields)), _r = _q.next(); !_r.done; _r = _q.next()) {
                                var field = _r.value;
                                var fieldName = getFieldDisplayName(field);
                                if (!valuesByField[fieldName]) {
                                    valuesByField[fieldName] = {
                                        name: fieldName,
                                        type: field.type,
                                        config: __assign({}, field.config),
                                        values: new ArrayVector(),
                                    };
                                }
                                valuesByField[fieldName].values.add(field.values.get(rowIndex));
                            }
                        }
                        catch (e_9_1) { e_9 = { error: e_9_1 }; }
                        finally {
                            try {
                                if (_r && !_r.done && (_p = _q.return)) _p.call(_q);
                            }
                            finally { if (e_9) throw e_9.error; }
                        }
                    };
                    for (var rowIndex = 0; rowIndex < frame.length; rowIndex++) {
                        _loop_1(rowIndex);
                    }
                    var fields = [];
                    var groupKeys = Object.keys(valuesByGroupKey);
                    try {
                        for (var groupByFields_1 = (e_3 = void 0, __values(groupByFields)), groupByFields_1_1 = groupByFields_1.next(); !groupByFields_1_1.done; groupByFields_1_1 = groupByFields_1.next()) {
                            var field = groupByFields_1_1.value;
                            var values = new ArrayVector();
                            var fieldName = getFieldDisplayName(field);
                            try {
                                for (var groupKeys_1 = (e_4 = void 0, __values(groupKeys)), groupKeys_1_1 = groupKeys_1.next(); !groupKeys_1_1.done; groupKeys_1_1 = groupKeys_1.next()) {
                                    var key = groupKeys_1_1.value;
                                    var valuesByField = valuesByGroupKey[key];
                                    values.add(valuesByField[fieldName].values.get(0));
                                }
                            }
                            catch (e_4_1) { e_4 = { error: e_4_1 }; }
                            finally {
                                try {
                                    if (groupKeys_1_1 && !groupKeys_1_1.done && (_d = groupKeys_1.return)) _d.call(groupKeys_1);
                                }
                                finally { if (e_4) throw e_4.error; }
                            }
                            fields.push({
                                name: field.name,
                                type: field.type,
                                config: __assign({}, field.config),
                                values: values,
                            });
                        }
                    }
                    catch (e_3_1) { e_3 = { error: e_3_1 }; }
                    finally {
                        try {
                            if (groupByFields_1_1 && !groupByFields_1_1.done && (_c = groupByFields_1.return)) _c.call(groupByFields_1);
                        }
                        finally { if (e_3) throw e_3.error; }
                    }
                    try {
                        // Then for each calculations configured, compute and add a new field (column)
                        for (var _m = (e_5 = void 0, __values(frame.fields)), _o = _m.next(); !_o.done; _o = _m.next()) {
                            var field = _o.value;
                            if (!shouldCalculateField(field, options)) {
                                continue;
                            }
                            var fieldName = getFieldDisplayName(field);
                            var aggregations = options.fields[fieldName].aggregations;
                            var valuesByAggregation = {};
                            try {
                                for (var groupKeys_2 = (e_6 = void 0, __values(groupKeys)), groupKeys_2_1 = groupKeys_2.next(); !groupKeys_2_1.done; groupKeys_2_1 = groupKeys_2.next()) {
                                    var groupKey = groupKeys_2_1.value;
                                    var fieldWithValuesForGroup = valuesByGroupKey[groupKey][fieldName];
                                    var results = reduceField({
                                        field: fieldWithValuesForGroup,
                                        reducers: aggregations,
                                    });
                                    try {
                                        for (var aggregations_1 = (e_7 = void 0, __values(aggregations)), aggregations_1_1 = aggregations_1.next(); !aggregations_1_1.done; aggregations_1_1 = aggregations_1.next()) {
                                            var aggregation = aggregations_1_1.value;
                                            if (!Array.isArray(valuesByAggregation[aggregation])) {
                                                valuesByAggregation[aggregation] = [];
                                            }
                                            valuesByAggregation[aggregation].push(results[aggregation]);
                                        }
                                    }
                                    catch (e_7_1) { e_7 = { error: e_7_1 }; }
                                    finally {
                                        try {
                                            if (aggregations_1_1 && !aggregations_1_1.done && (_g = aggregations_1.return)) _g.call(aggregations_1);
                                        }
                                        finally { if (e_7) throw e_7.error; }
                                    }
                                }
                            }
                            catch (e_6_1) { e_6 = { error: e_6_1 }; }
                            finally {
                                try {
                                    if (groupKeys_2_1 && !groupKeys_2_1.done && (_f = groupKeys_2.return)) _f.call(groupKeys_2);
                                }
                                finally { if (e_6) throw e_6.error; }
                            }
                            try {
                                for (var aggregations_2 = (e_8 = void 0, __values(aggregations)), aggregations_2_1 = aggregations_2.next(); !aggregations_2_1.done; aggregations_2_1 = aggregations_2.next()) {
                                    var aggregation = aggregations_2_1.value;
                                    var aggregationField = {
                                        name: fieldName + " (" + aggregation + ")",
                                        values: new ArrayVector(valuesByAggregation[aggregation]),
                                        type: FieldType.other,
                                        config: {},
                                    };
                                    aggregationField.type = detectFieldType(aggregation, field, aggregationField);
                                    fields.push(aggregationField);
                                }
                            }
                            catch (e_8_1) { e_8 = { error: e_8_1 }; }
                            finally {
                                try {
                                    if (aggregations_2_1 && !aggregations_2_1.done && (_h = aggregations_2.return)) _h.call(aggregations_2);
                                }
                                finally { if (e_8) throw e_8.error; }
                            }
                        }
                    }
                    catch (e_5_1) { e_5 = { error: e_5_1 }; }
                    finally {
                        try {
                            if (_o && !_o.done && (_e = _m.return)) _e.call(_m);
                        }
                        finally { if (e_5) throw e_5.error; }
                    }
                    processed.push({
                        fields: fields,
                        length: groupKeys.length,
                    });
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return processed;
        }));
    }; },
};
var shouldGroupOnField = function (field, options) {
    var _a;
    var fieldName = getFieldDisplayName(field);
    return ((_a = options === null || options === void 0 ? void 0 : options.fields[fieldName]) === null || _a === void 0 ? void 0 : _a.operation) === GroupByOperationID.groupBy;
};
var shouldCalculateField = function (field, options) {
    var _a;
    var fieldName = getFieldDisplayName(field);
    return (((_a = options === null || options === void 0 ? void 0 : options.fields[fieldName]) === null || _a === void 0 ? void 0 : _a.operation) === GroupByOperationID.aggregate &&
        Array.isArray(options === null || options === void 0 ? void 0 : options.fields[fieldName].aggregations) &&
        (options === null || options === void 0 ? void 0 : options.fields[fieldName].aggregations.length) > 0);
};
var detectFieldType = function (aggregation, sourceField, targetField) {
    var _a;
    switch (aggregation) {
        case ReducerID.allIsNull:
            return FieldType.boolean;
        case ReducerID.last:
        case ReducerID.lastNotNull:
        case ReducerID.first:
        case ReducerID.firstNotNull:
            return sourceField.type;
        default:
            return (_a = guessFieldTypeForField(targetField)) !== null && _a !== void 0 ? _a : FieldType.string;
    }
};
//# sourceMappingURL=groupBy.js.map