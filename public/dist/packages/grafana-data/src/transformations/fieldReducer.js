import { __assign, __values } from "tslib";
// Libraries
import { isNumber } from 'lodash';
import { NullValueMode, FieldType } from '../types/index';
import { Registry } from '../utils/Registry';
export var ReducerID;
(function (ReducerID) {
    ReducerID["sum"] = "sum";
    ReducerID["max"] = "max";
    ReducerID["min"] = "min";
    ReducerID["logmin"] = "logmin";
    ReducerID["mean"] = "mean";
    ReducerID["last"] = "last";
    ReducerID["first"] = "first";
    ReducerID["count"] = "count";
    ReducerID["range"] = "range";
    ReducerID["diff"] = "diff";
    ReducerID["diffperc"] = "diffperc";
    ReducerID["delta"] = "delta";
    ReducerID["step"] = "step";
    ReducerID["firstNotNull"] = "firstNotNull";
    ReducerID["lastNotNull"] = "lastNotNull";
    ReducerID["changeCount"] = "changeCount";
    ReducerID["distinctCount"] = "distinctCount";
    ReducerID["allIsZero"] = "allIsZero";
    ReducerID["allIsNull"] = "allIsNull";
    ReducerID["allValues"] = "allValues";
})(ReducerID || (ReducerID = {}));
/**
 * @returns an object with a key for each selected stat
 * NOTE: This will also modify the 'field.state' object,
 * leaving values in a cache until cleared.
 */
export function reduceField(options) {
    var e_1, _a, e_2, _b, e_3, _c;
    var _d;
    var field = options.field, reducers = options.reducers;
    if (!field || !reducers || reducers.length < 1) {
        return {};
    }
    if ((_d = field.state) === null || _d === void 0 ? void 0 : _d.calcs) {
        // Find the values we need to calculate
        var missing = [];
        try {
            for (var reducers_1 = __values(reducers), reducers_1_1 = reducers_1.next(); !reducers_1_1.done; reducers_1_1 = reducers_1.next()) {
                var s = reducers_1_1.value;
                if (!field.state.calcs.hasOwnProperty(s)) {
                    missing.push(s);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (reducers_1_1 && !reducers_1_1.done && (_a = reducers_1.return)) _a.call(reducers_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (missing.length < 1) {
            return __assign({}, field.state.calcs);
        }
    }
    if (!field.state) {
        field.state = {};
    }
    var queue = fieldReducers.list(reducers);
    // Return early for empty series
    // This lets the concrete implementations assume at least one row
    var data = field.values;
    if (data.length < 1) {
        var calcs = __assign({}, field.state.calcs);
        try {
            for (var queue_1 = __values(queue), queue_1_1 = queue_1.next(); !queue_1_1.done; queue_1_1 = queue_1.next()) {
                var reducer = queue_1_1.value;
                calcs[reducer.id] = reducer.emptyInputResult !== null ? reducer.emptyInputResult : null;
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (queue_1_1 && !queue_1_1.done && (_b = queue_1.return)) _b.call(queue_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return (field.state.calcs = calcs);
    }
    var nullValueMode = field.config.nullValueMode;
    var ignoreNulls = nullValueMode === NullValueMode.Ignore;
    var nullAsZero = nullValueMode === NullValueMode.AsZero;
    // Avoid calculating all the standard stats if possible
    if (queue.length === 1 && queue[0].reduce) {
        var values_1 = queue[0].reduce(field, ignoreNulls, nullAsZero);
        field.state.calcs = __assign(__assign({}, field.state.calcs), values_1);
        return values_1;
    }
    // For now everything can use the standard stats
    var values = doStandardCalcs(field, ignoreNulls, nullAsZero);
    try {
        for (var queue_2 = __values(queue), queue_2_1 = queue_2.next(); !queue_2_1.done; queue_2_1 = queue_2.next()) {
            var reducer = queue_2_1.value;
            if (!values.hasOwnProperty(reducer.id) && reducer.reduce) {
                values = __assign(__assign({}, values), reducer.reduce(field, ignoreNulls, nullAsZero));
            }
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (queue_2_1 && !queue_2_1.done && (_c = queue_2.return)) _c.call(queue_2);
        }
        finally { if (e_3) throw e_3.error; }
    }
    field.state.calcs = __assign(__assign({}, field.state.calcs), values);
    return values;
}
// ------------------------------------------------------------------------------
//
//  No Exported symbols below here.
//
// ------------------------------------------------------------------------------
export var fieldReducers = new Registry(function () { return [
    {
        id: ReducerID.lastNotNull,
        name: 'Last *',
        description: 'Last non-null value',
        standard: true,
        aliasIds: ['current'],
        reduce: calculateLastNotNull,
    },
    {
        id: ReducerID.last,
        name: 'Last',
        description: 'Last value',
        standard: true,
        reduce: calculateLast,
    },
    { id: ReducerID.first, name: 'First', description: 'First Value', standard: true, reduce: calculateFirst },
    {
        id: ReducerID.firstNotNull,
        name: 'First',
        description: 'First non-null value',
        standard: true,
        reduce: calculateFirstNotNull,
    },
    { id: ReducerID.min, name: 'Min', description: 'Minimum Value', standard: true },
    { id: ReducerID.max, name: 'Max', description: 'Maximum Value', standard: true },
    { id: ReducerID.mean, name: 'Mean', description: 'Average Value', standard: true, aliasIds: ['avg'] },
    {
        id: ReducerID.sum,
        name: 'Total',
        description: 'The sum of all values',
        emptyInputResult: 0,
        standard: true,
        aliasIds: ['total'],
    },
    {
        id: ReducerID.count,
        name: 'Count',
        description: 'Number of values in response',
        emptyInputResult: 0,
        standard: true,
    },
    {
        id: ReducerID.range,
        name: 'Range',
        description: 'Difference between minimum and maximum values',
        standard: true,
    },
    {
        id: ReducerID.delta,
        name: 'Delta',
        description: 'Cumulative change in value',
        standard: true,
    },
    {
        id: ReducerID.step,
        name: 'Step',
        description: 'Minimum interval between values',
        standard: true,
    },
    {
        id: ReducerID.diff,
        name: 'Difference',
        description: 'Difference between first and last values',
        standard: true,
    },
    {
        id: ReducerID.logmin,
        name: 'Min (above zero)',
        description: 'Used for log min scale',
        standard: true,
    },
    {
        id: ReducerID.allIsZero,
        name: 'All Zeros',
        description: 'All values are zero',
        emptyInputResult: false,
        standard: true,
    },
    {
        id: ReducerID.allIsNull,
        name: 'All Nulls',
        description: 'All values are null',
        emptyInputResult: true,
        standard: true,
    },
    {
        id: ReducerID.changeCount,
        name: 'Change Count',
        description: 'Number of times the value changes',
        standard: false,
        reduce: calculateChangeCount,
    },
    {
        id: ReducerID.distinctCount,
        name: 'Distinct Count',
        description: 'Number of distinct values',
        standard: false,
        reduce: calculateDistinctCount,
    },
    {
        id: ReducerID.diffperc,
        name: 'Difference percent',
        description: 'Percentage difference between first and last values',
        standard: true,
    },
    {
        id: ReducerID.allValues,
        name: 'All values',
        description: 'Returns an array with all values',
        standard: false,
        reduce: function (field) { return ({ allValues: field.values.toArray() }); },
    },
]; });
export function doStandardCalcs(field, ignoreNulls, nullAsZero) {
    var calcs = {
        sum: 0,
        max: -Number.MAX_VALUE,
        min: Number.MAX_VALUE,
        logmin: Number.MAX_VALUE,
        mean: null,
        last: null,
        first: null,
        lastNotNull: null,
        firstNotNull: null,
        count: 0,
        nonNullCount: 0,
        allIsNull: true,
        allIsZero: true,
        range: null,
        diff: null,
        delta: 0,
        step: Number.MAX_VALUE,
        diffperc: 0,
        // Just used for calculations -- not exposed as a stat
        previousDeltaUp: true,
    };
    var data = field.values;
    calcs.count = data.length;
    var isNumberField = field.type === FieldType.number || FieldType.time;
    for (var i = 0; i < data.length; i++) {
        var currentValue = data.get(i);
        if (i === 0) {
            calcs.first = currentValue;
        }
        calcs.last = currentValue;
        if (currentValue === null) {
            if (ignoreNulls) {
                continue;
            }
            if (nullAsZero) {
                currentValue = 0;
            }
        }
        if (currentValue != null) {
            // null || undefined
            var isFirst = calcs.firstNotNull === null;
            if (isFirst) {
                calcs.firstNotNull = currentValue;
            }
            if (isNumberField) {
                calcs.sum += currentValue;
                calcs.allIsNull = false;
                calcs.nonNullCount++;
                if (!isFirst) {
                    var step = currentValue - calcs.lastNotNull;
                    if (calcs.step > step) {
                        calcs.step = step; // the minimum interval
                    }
                    if (calcs.lastNotNull > currentValue) {
                        // counter reset
                        calcs.previousDeltaUp = false;
                        if (i === data.length - 1) {
                            // reset on last
                            calcs.delta += currentValue;
                        }
                    }
                    else {
                        if (calcs.previousDeltaUp) {
                            calcs.delta += step; // normal increment
                        }
                        else {
                            calcs.delta += currentValue; // account for counter reset
                        }
                        calcs.previousDeltaUp = true;
                    }
                }
                if (currentValue > calcs.max) {
                    calcs.max = currentValue;
                }
                if (currentValue < calcs.min) {
                    calcs.min = currentValue;
                }
                if (currentValue < calcs.logmin && currentValue > 0) {
                    calcs.logmin = currentValue;
                }
            }
            if (currentValue !== 0) {
                calcs.allIsZero = false;
            }
            calcs.lastNotNull = currentValue;
        }
    }
    if (calcs.max === -Number.MAX_VALUE) {
        calcs.max = null;
    }
    if (calcs.min === Number.MAX_VALUE) {
        calcs.min = null;
    }
    if (calcs.step === Number.MAX_VALUE) {
        calcs.step = null;
    }
    if (calcs.nonNullCount > 0) {
        calcs.mean = calcs.sum / calcs.nonNullCount;
    }
    if (calcs.allIsNull) {
        calcs.allIsZero = false;
    }
    if (calcs.max !== null && calcs.min !== null) {
        calcs.range = calcs.max - calcs.min;
    }
    if (isNumber(calcs.firstNotNull) && isNumber(calcs.lastNotNull)) {
        calcs.diff = calcs.lastNotNull - calcs.firstNotNull;
    }
    if (isNumber(calcs.firstNotNull) && isNumber(calcs.diff)) {
        calcs.diffperc = calcs.diff / calcs.firstNotNull;
    }
    return calcs;
}
function calculateFirst(field, ignoreNulls, nullAsZero) {
    return { first: field.values.get(0) };
}
function calculateFirstNotNull(field, ignoreNulls, nullAsZero) {
    var data = field.values;
    for (var idx = 0; idx < data.length; idx++) {
        var v = data.get(idx);
        if (v != null && v !== undefined) {
            return { firstNotNull: v };
        }
    }
    return { firstNotNull: null };
}
function calculateLast(field, ignoreNulls, nullAsZero) {
    var data = field.values;
    return { last: data.get(data.length - 1) };
}
function calculateLastNotNull(field, ignoreNulls, nullAsZero) {
    var data = field.values;
    var idx = data.length - 1;
    while (idx >= 0) {
        var v = data.get(idx--);
        if (v != null && v !== undefined) {
            return { lastNotNull: v };
        }
    }
    return { lastNotNull: null };
}
function calculateChangeCount(field, ignoreNulls, nullAsZero) {
    var data = field.values;
    var count = 0;
    var first = true;
    var last = null;
    for (var i = 0; i < data.length; i++) {
        var currentValue = data.get(i);
        if (currentValue === null) {
            if (ignoreNulls) {
                continue;
            }
            if (nullAsZero) {
                currentValue = 0;
            }
        }
        if (!first && last !== currentValue) {
            count++;
        }
        first = false;
        last = currentValue;
    }
    return { changeCount: count };
}
function calculateDistinctCount(field, ignoreNulls, nullAsZero) {
    var data = field.values;
    var distinct = new Set();
    for (var i = 0; i < data.length; i++) {
        var currentValue = data.get(i);
        if (currentValue === null) {
            if (ignoreNulls) {
                continue;
            }
            if (nullAsZero) {
                currentValue = 0;
            }
        }
        distinct.add(currentValue);
    }
    return { distinctCount: distinct.size };
}
//# sourceMappingURL=fieldReducer.js.map