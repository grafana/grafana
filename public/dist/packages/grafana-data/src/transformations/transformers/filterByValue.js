import { __assign, __values } from "tslib";
import { map } from 'rxjs/operators';
import { noopTransformer } from './noop';
import { DataTransformerID } from './ids';
import { getFieldDisplayName } from '../../field/fieldState';
import { getValueMatcher } from '../matchers';
import { ArrayVector } from '../../vector/ArrayVector';
export var FilterByValueType;
(function (FilterByValueType) {
    FilterByValueType["exclude"] = "exclude";
    FilterByValueType["include"] = "include";
})(FilterByValueType || (FilterByValueType = {}));
export var FilterByValueMatch;
(function (FilterByValueMatch) {
    FilterByValueMatch["all"] = "all";
    FilterByValueMatch["any"] = "any";
})(FilterByValueMatch || (FilterByValueMatch = {}));
export var filterByValueTransformer = {
    id: DataTransformerID.filterByValue,
    name: 'Filter data by values',
    description: 'select a subset of results based on values',
    defaultOptions: {
        filters: [],
        type: FilterByValueType.include,
        match: FilterByValueMatch.any,
    },
    operator: function (options) { return function (source) {
        var filters = options.filters;
        var matchAll = options.match === FilterByValueMatch.all;
        var include = options.type === FilterByValueType.include;
        if (!Array.isArray(filters) || filters.length === 0) {
            return source.pipe(noopTransformer.operator({}));
        }
        return source.pipe(map(function (data) {
            var e_1, _a, e_2, _b, e_3, _c, e_4, _d;
            if (!Array.isArray(data) || data.length === 0) {
                return data;
            }
            var rows = new Set();
            try {
                for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
                    var frame = data_1_1.value;
                    var fieldIndexByName = groupFieldIndexByName(frame, data);
                    var matchers = createFilterValueMatchers(filters, fieldIndexByName);
                    for (var index = 0; index < frame.length; index++) {
                        if (rows.has(index)) {
                            continue;
                        }
                        var matching = true;
                        try {
                            for (var matchers_1 = (e_2 = void 0, __values(matchers)), matchers_1_1 = matchers_1.next(); !matchers_1_1.done; matchers_1_1 = matchers_1.next()) {
                                var matcher = matchers_1_1.value;
                                var match = matcher(index, frame, data);
                                if (!matchAll && match) {
                                    matching = true;
                                    break;
                                }
                                if (matchAll && !match) {
                                    matching = false;
                                    break;
                                }
                                matching = match;
                            }
                        }
                        catch (e_2_1) { e_2 = { error: e_2_1 }; }
                        finally {
                            try {
                                if (matchers_1_1 && !matchers_1_1.done && (_b = matchers_1.return)) _b.call(matchers_1);
                            }
                            finally { if (e_2) throw e_2.error; }
                        }
                        if (matching) {
                            rows.add(index);
                        }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            var processed = [];
            var frameLength = include ? rows.size : data[0].length - rows.size;
            try {
                for (var data_2 = __values(data), data_2_1 = data_2.next(); !data_2_1.done; data_2_1 = data_2.next()) {
                    var frame = data_2_1.value;
                    var fields = [];
                    try {
                        for (var _e = (e_4 = void 0, __values(frame.fields)), _f = _e.next(); !_f.done; _f = _e.next()) {
                            var field = _f.value;
                            var buffer = [];
                            for (var index = 0; index < frame.length; index++) {
                                if (include && rows.has(index)) {
                                    buffer.push(field.values.get(index));
                                    continue;
                                }
                                if (!include && !rows.has(index)) {
                                    buffer.push(field.values.get(index));
                                    continue;
                                }
                            }
                            // We keep field config, but clean the state as it's being recalculated when the field overrides are applied
                            fields.push(__assign(__assign({}, field), { values: new ArrayVector(buffer), state: {} }));
                        }
                    }
                    catch (e_4_1) { e_4 = { error: e_4_1 }; }
                    finally {
                        try {
                            if (_f && !_f.done && (_d = _e.return)) _d.call(_e);
                        }
                        finally { if (e_4) throw e_4.error; }
                    }
                    processed.push(__assign(__assign({}, frame), { fields: fields, length: frameLength }));
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (data_2_1 && !data_2_1.done && (_c = data_2.return)) _c.call(data_2);
                }
                finally { if (e_3) throw e_3.error; }
            }
            return processed;
        }));
    }; },
};
var createFilterValueMatchers = function (filters, fieldIndexByName) {
    var noop = function () { return false; };
    return filters.map(function (filter) {
        var _a;
        var fieldIndex = (_a = fieldIndexByName[filter.fieldName]) !== null && _a !== void 0 ? _a : -1;
        if (fieldIndex < 0) {
            console.warn("[FilterByValue] Could not find index for field name: " + filter.fieldName);
            return noop;
        }
        var matcher = getValueMatcher(filter.config);
        return function (index, frame, data) { return matcher(index, frame.fields[fieldIndex], frame, data); };
    });
};
var groupFieldIndexByName = function (frame, data) {
    return frame.fields.reduce(function (all, field, fieldIndex) {
        var fieldName = getFieldDisplayName(field, frame, data);
        all[fieldName] = fieldIndex;
        return all;
    }, {});
};
//# sourceMappingURL=filterByValue.js.map