import { __assign, __read, __rest, __spreadArray, __values } from "tslib";
// Libraries
import { isArray, isBoolean, isNumber, isString } from 'lodash';
// Types
import { FieldType, TIME_SERIES_VALUE_FIELD_NAME, TIME_SERIES_TIME_FIELD_NAME, } from '../types/index';
import { isDateTime } from '../datetime/moment_wrapper';
import { ArrayVector } from '../vector/ArrayVector';
import { MutableDataFrame } from './MutableDataFrame';
import { SortedVector } from '../vector/SortedVector';
import { ArrayDataFrame } from './ArrayDataFrame';
import { getFieldDisplayName } from '../field/fieldState';
import { fieldIndexComparer } from '../field/fieldComparers';
import { vectorToArray } from '../vector/vectorToArray';
import { dataFrameFromJSON } from './DataFrameJSON';
function convertTableToDataFrame(table) {
    var e_1, _a, e_2, _b;
    var fields = table.columns.map(function (c) {
        // TODO: should be Column but type does not exists there so not sure whats up here.
        var _a = c, text = _a.text, type = _a.type, disp = __rest(_a, ["text", "type"]);
        return {
            name: text,
            config: (disp || {}),
            values: new ArrayVector(),
            type: type && Object.values(FieldType).includes(type) ? type : FieldType.other,
        };
    });
    if (!isArray(table.rows)) {
        throw new Error("Expected table rows to be array, got " + typeof table.rows + ".");
    }
    try {
        for (var _c = __values(table.rows), _d = _c.next(); !_d.done; _d = _c.next()) {
            var row = _d.value;
            for (var i = 0; i < fields.length; i++) {
                fields[i].values.buffer.push(row[i]);
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
        }
        finally { if (e_1) throw e_1.error; }
    }
    try {
        for (var fields_1 = __values(fields), fields_1_1 = fields_1.next(); !fields_1_1.done; fields_1_1 = fields_1.next()) {
            var f = fields_1_1.value;
            if (f.type === FieldType.other) {
                var t = guessFieldTypeForField(f);
                if (t) {
                    f.type = t;
                }
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (fields_1_1 && !fields_1_1.done && (_b = fields_1.return)) _b.call(fields_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return {
        fields: fields,
        refId: table.refId,
        meta: table.meta,
        name: table.name,
        length: table.rows.length,
    };
}
function convertTimeSeriesToDataFrame(timeSeries) {
    var e_3, _a;
    var times = [];
    var values = [];
    // Sometimes the points are sent as datapoints
    var points = timeSeries.datapoints || timeSeries.points;
    try {
        for (var points_1 = __values(points), points_1_1 = points_1.next(); !points_1_1.done; points_1_1 = points_1.next()) {
            var point = points_1_1.value;
            values.push(point[0]);
            times.push(point[1]);
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (points_1_1 && !points_1_1.done && (_a = points_1.return)) _a.call(points_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
    var fields = [
        {
            name: TIME_SERIES_TIME_FIELD_NAME,
            type: FieldType.time,
            config: {},
            values: new ArrayVector(times),
        },
        {
            name: TIME_SERIES_VALUE_FIELD_NAME,
            type: FieldType.number,
            config: {
                unit: timeSeries.unit,
            },
            values: new ArrayVector(values),
            labels: timeSeries.tags,
        },
    ];
    if (timeSeries.title) {
        fields[1].config.displayNameFromDS = timeSeries.title;
    }
    return {
        name: timeSeries.target || timeSeries.name,
        refId: timeSeries.refId,
        meta: timeSeries.meta,
        fields: fields,
        length: values.length,
    };
}
/**
 * This is added temporarily while we convert the LogsModel
 * to DataFrame.  See: https://github.com/grafana/grafana/issues/18528
 */
function convertGraphSeriesToDataFrame(graphSeries) {
    var x = new ArrayVector();
    var y = new ArrayVector();
    for (var i = 0; i < graphSeries.data.length; i++) {
        var row = graphSeries.data[i];
        x.buffer.push(row[1]);
        y.buffer.push(row[0]);
    }
    return {
        name: graphSeries.label,
        fields: [
            {
                name: graphSeries.label || TIME_SERIES_VALUE_FIELD_NAME,
                type: FieldType.number,
                config: {},
                values: x,
            },
            {
                name: TIME_SERIES_TIME_FIELD_NAME,
                type: FieldType.time,
                config: {
                    unit: 'dateTimeAsIso',
                },
                values: y,
            },
        ],
        length: x.buffer.length,
    };
}
function convertJSONDocumentDataToDataFrame(timeSeries) {
    var e_4, _a;
    var fields = [
        {
            name: timeSeries.target,
            type: FieldType.other,
            labels: timeSeries.tags,
            config: {
                unit: timeSeries.unit,
                filterable: timeSeries.filterable,
            },
            values: new ArrayVector(),
        },
    ];
    try {
        for (var _b = __values(timeSeries.datapoints), _c = _b.next(); !_c.done; _c = _b.next()) {
            var point = _c.value;
            fields[0].values.buffer.push(point);
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_4) throw e_4.error; }
    }
    return {
        name: timeSeries.target,
        refId: timeSeries.target,
        meta: { json: true },
        fields: fields,
        length: timeSeries.datapoints.length,
    };
}
// PapaParse Dynamic Typing regex:
// https://github.com/mholt/PapaParse/blob/master/papaparse.js#L998
var NUMBER = /^\s*(-?(\d*\.?\d+|\d+\.?\d*)(e[-+]?\d+)?|NAN)\s*$/i;
/**
 * Given a name and value, this will pick a reasonable field type
 */
export function guessFieldTypeFromNameAndValue(name, v) {
    if (name) {
        name = name.toLowerCase();
        if (name === 'date' || name === 'time') {
            return FieldType.time;
        }
    }
    return guessFieldTypeFromValue(v);
}
/**
 * Given a value this will guess the best column type
 *
 * TODO: better Date/Time support!  Look for standard date strings?
 */
export function guessFieldTypeFromValue(v) {
    if (v instanceof Date || isDateTime(v)) {
        return FieldType.time;
    }
    if (isNumber(v)) {
        return FieldType.number;
    }
    if (isString(v)) {
        if (NUMBER.test(v)) {
            return FieldType.number;
        }
        if (v === 'true' || v === 'TRUE' || v === 'True' || v === 'false' || v === 'FALSE' || v === 'False') {
            return FieldType.boolean;
        }
        return FieldType.string;
    }
    if (isBoolean(v)) {
        return FieldType.boolean;
    }
    return FieldType.other;
}
/**
 * Looks at the data to guess the column type.  This ignores any existing setting
 */
export function guessFieldTypeForField(field) {
    // 1. Use the column name to guess
    if (field.name) {
        var name_1 = field.name.toLowerCase();
        if (name_1 === 'date' || name_1 === 'time') {
            return FieldType.time;
        }
    }
    // 2. Check the first non-null value
    for (var i = 0; i < field.values.length; i++) {
        var v = field.values.get(i);
        if (v !== null) {
            return guessFieldTypeFromValue(v);
        }
    }
    // Could not find anything
    return undefined;
}
/**
 * @returns A copy of the series with the best guess for each field type.
 * If the series already has field types defined, they will be used, unless `guessDefined` is true.
 * @param series The DataFrame whose field's types should be guessed
 * @param guessDefined Whether to guess types of fields with already defined types
 */
export var guessFieldTypes = function (series, guessDefined) {
    var e_5, _a;
    if (guessDefined === void 0) { guessDefined = false; }
    try {
        for (var _b = __values(series.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
            var field = _c.value;
            if (!field.type || field.type === FieldType.other || guessDefined) {
                // Something is missing a type, return a modified copy
                return __assign(__assign({}, series), { fields: series.fields.map(function (field) {
                        if (field.type && field.type !== FieldType.other && !guessDefined) {
                            return field;
                        }
                        // Calculate a reasonable schema value
                        return __assign(__assign({}, field), { type: guessFieldTypeForField(field) || FieldType.other });
                    }) });
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
    // No changes necessary
    return series;
};
export var isTableData = function (data) { return data && data.hasOwnProperty('columns'); };
export var isDataFrame = function (data) { return data && data.hasOwnProperty('fields'); };
/**
 * Inspect any object and return the results as a DataFrame
 */
export function toDataFrame(data) {
    if ('fields' in data) {
        // DataFrameDTO does not have length
        if ('length' in data) {
            return data;
        }
        // This will convert the array values into Vectors
        return new MutableDataFrame(data);
    }
    // Handle legacy docs/json type
    if (data.hasOwnProperty('type') && data.type === 'docs') {
        return convertJSONDocumentDataToDataFrame(data);
    }
    if (data.hasOwnProperty('datapoints') || data.hasOwnProperty('points')) {
        return convertTimeSeriesToDataFrame(data);
    }
    if (data.hasOwnProperty('data')) {
        if (data.hasOwnProperty('schema')) {
            return dataFrameFromJSON(data);
        }
        return convertGraphSeriesToDataFrame(data);
    }
    if (data.hasOwnProperty('columns')) {
        return convertTableToDataFrame(data);
    }
    if (Array.isArray(data)) {
        return new ArrayDataFrame(data);
    }
    console.warn('Can not convert', data);
    throw new Error('Unsupported data format');
}
export var toLegacyResponseData = function (frame) {
    var fields = frame.fields;
    var rowCount = frame.length;
    var rows = [];
    if (fields.length === 2) {
        var _a = getTimeField(frame), timeField = _a.timeField, timeIndex = _a.timeIndex;
        if (timeField) {
            var valueIndex = timeIndex === 0 ? 1 : 0;
            var valueField = fields[valueIndex];
            var timeField_1 = fields[timeIndex];
            // Make sure it is [value,time]
            for (var i = 0; i < rowCount; i++) {
                rows.push([
                    valueField.values.get(i),
                    timeField_1.values.get(i), // time
                ]);
            }
            return {
                alias: frame.name,
                target: getFieldDisplayName(valueField, frame),
                datapoints: rows,
                unit: fields[0].config ? fields[0].config.unit : undefined,
                refId: frame.refId,
                meta: frame.meta,
            };
        }
    }
    for (var i = 0; i < rowCount; i++) {
        var row = [];
        for (var j = 0; j < fields.length; j++) {
            row.push(fields[j].values.get(i));
        }
        rows.push(row);
    }
    if (frame.meta && frame.meta.json) {
        return {
            alias: fields[0].name || frame.name,
            target: fields[0].name || frame.name,
            datapoints: fields[0].values.toArray(),
            filterable: fields[0].config ? fields[0].config.filterable : undefined,
            type: 'docs',
        };
    }
    return {
        columns: fields.map(function (f) {
            var name = f.name, config = f.config;
            if (config) {
                // keep unit etc
                var column = __rest(config, []);
                column.text = name;
                return column;
            }
            return { text: name };
        }),
        type: 'table',
        refId: frame.refId,
        meta: frame.meta,
        rows: rows,
    };
};
export function sortDataFrame(data, sortIndex, reverse) {
    if (reverse === void 0) { reverse = false; }
    var field = data.fields[sortIndex];
    if (!field) {
        return data;
    }
    // Natural order
    var index = [];
    for (var i = 0; i < data.length; i++) {
        index.push(i);
    }
    var fieldComparer = fieldIndexComparer(field, reverse);
    index.sort(fieldComparer);
    return __assign(__assign({}, data), { fields: data.fields.map(function (f) {
            return __assign(__assign({}, f), { values: new SortedVector(f.values, index) });
        }) });
}
/**
 * Returns a copy with all values reversed
 */
export function reverseDataFrame(data) {
    return __assign(__assign({}, data), { fields: data.fields.map(function (f) {
            var copy = __spreadArray([], __read(f.values.toArray()), false);
            copy.reverse();
            return __assign(__assign({}, f), { values: new ArrayVector(copy) });
        }) });
}
/**
 * Wrapper to get an array from each field value
 */
export function getDataFrameRow(data, row) {
    var e_6, _a;
    var values = [];
    try {
        for (var _b = __values(data.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
            var field = _c.value;
            values.push(field.values.get(row));
        }
    }
    catch (e_6_1) { e_6 = { error: e_6_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_6) throw e_6.error; }
    }
    return values;
}
/**
 * Returns a copy that does not include functions
 */
export function toDataFrameDTO(data) {
    var fields = data.fields.map(function (f) {
        var values = f.values.toArray();
        // The byte buffers serialize like objects
        if (values instanceof Float64Array) {
            values = vectorToArray(f.values);
        }
        return {
            name: f.name,
            type: f.type,
            config: f.config,
            values: values,
            labels: f.labels,
        };
    });
    return {
        fields: fields,
        refId: data.refId,
        meta: data.meta,
        name: data.name,
    };
}
export var getTimeField = function (series) {
    for (var i = 0; i < series.fields.length; i++) {
        if (series.fields[i].type === FieldType.time) {
            return {
                timeField: series.fields[i],
                timeIndex: i,
            };
        }
    }
    return {};
};
//# sourceMappingURL=processDataFrame.js.map