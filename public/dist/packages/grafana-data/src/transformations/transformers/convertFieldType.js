import { __assign, __values } from "tslib";
import { map } from 'rxjs/operators';
import { DataTransformerID } from './ids';
import { FieldType } from '../../types/dataFrame';
import { dateTimeParse } from '../../datetime';
import { ArrayVector } from '../../vector';
import { fieldMatchers } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';
export var convertFieldTypeTransformer = {
    id: DataTransformerID.convertFieldType,
    name: 'Convert field type',
    description: 'Convert a field to a specified field type',
    defaultOptions: {
        fields: {},
        conversions: [{ targetField: undefined, destinationType: undefined, dateFormat: undefined }],
    },
    operator: function (options) { return function (source) { return source.pipe(map(function (data) { return convertFieldTypeTransformer.transformer(options)(data); })); }; },
    transformer: function (options) { return function (data) {
        if (!Array.isArray(data) || data.length === 0) {
            return data;
        }
        var timeParsed = convertFieldTypes(options, data);
        if (!timeParsed) {
            return [];
        }
        return timeParsed;
    }; },
};
/**
 * Convert field types for dataframe(s)
 * @param options - field type conversion options
 * @param frames - dataframe(s) with field types to convert
 * @returns dataframe(s) with converted field types
 */
export function convertFieldTypes(options, frames) {
    var e_1, _a;
    if (!options.conversions.length) {
        return frames;
    }
    var framesCopy = frames.map(function (frame) { return (__assign({}, frame)); });
    var _loop_1 = function (conversion) {
        var e_2, _d;
        if (!conversion.targetField) {
            return "continue";
        }
        var matches = fieldMatchers.get(FieldMatcherID.byName).get(conversion.targetField);
        var _loop_2 = function (frame) {
            frame.fields = frame.fields.map(function (field) {
                if (matches(field, frame, framesCopy)) {
                    return convertFieldType(field, conversion);
                }
                return field;
            });
        };
        try {
            for (var framesCopy_1 = (e_2 = void 0, __values(framesCopy)), framesCopy_1_1 = framesCopy_1.next(); !framesCopy_1_1.done; framesCopy_1_1 = framesCopy_1.next()) {
                var frame = framesCopy_1_1.value;
                _loop_2(frame);
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (framesCopy_1_1 && !framesCopy_1_1.done && (_d = framesCopy_1.return)) _d.call(framesCopy_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
    };
    try {
        for (var _b = __values(options.conversions), _c = _b.next(); !_c.done; _c = _b.next()) {
            var conversion = _c.value;
            _loop_1(conversion);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return framesCopy;
}
/**
 * Convert a single field type to specifed field type.
 * @param field - field to convert
 * @param opts - field conversion options
 * @returns converted field
 *
 * @internal
 */
export function convertFieldType(field, opts) {
    switch (opts.destinationType) {
        case FieldType.time:
            return ensureTimeField(field, opts.dateFormat);
        case FieldType.number:
            return fieldToNumberField(field);
        case FieldType.string:
            return fieldToStringField(field);
        case FieldType.boolean:
            return fieldToBooleanField(field);
        default:
            return field;
    }
}
/**
 * @internal
 */
export function fieldToTimeField(field, dateFormat) {
    var opts = dateFormat ? { format: dateFormat } : undefined;
    var timeValues = field.values.toArray().slice();
    for (var t = 0; t < timeValues.length; t++) {
        if (timeValues[t]) {
            var parsed = dateTimeParse(timeValues[t], opts).valueOf();
            timeValues[t] = Number.isFinite(parsed) ? parsed : null;
        }
        else {
            timeValues[t] = null;
        }
    }
    return __assign(__assign({}, field), { type: FieldType.time, values: new ArrayVector(timeValues) });
}
function fieldToNumberField(field) {
    var numValues = field.values.toArray().slice();
    for (var n = 0; n < numValues.length; n++) {
        var number = +numValues[n];
        numValues[n] = Number.isFinite(number) ? number : null;
    }
    return __assign(__assign({}, field), { type: FieldType.number, values: new ArrayVector(numValues) });
}
function fieldToBooleanField(field) {
    var booleanValues = field.values.toArray().slice();
    for (var b = 0; b < booleanValues.length; b++) {
        booleanValues[b] = Boolean(!!booleanValues[b]);
    }
    return __assign(__assign({}, field), { type: FieldType.boolean, values: new ArrayVector(booleanValues) });
}
function fieldToStringField(field) {
    var stringValues = field.values.toArray().slice();
    for (var s = 0; s < stringValues.length; s++) {
        stringValues[s] = "" + stringValues[s];
    }
    return __assign(__assign({}, field), { type: FieldType.string, values: new ArrayVector(stringValues) });
}
/**
 * Checks the first value. Assumes any number should be time fieldtype. Otherwise attempts to make the fieldtype time.
 * @param field - field to ensure is a time fieldtype
 * @param dateFormat - date format used to parse a string datetime
 * @returns field as time
 *
 * @public
 */
export function ensureTimeField(field, dateFormat) {
    var firstValueTypeIsNumber = typeof field.values.get(0) === 'number';
    if (field.type === FieldType.time && firstValueTypeIsNumber) {
        return field; //already time
    }
    if (firstValueTypeIsNumber) {
        return __assign(__assign({}, field), { type: FieldType.time });
    }
    return fieldToTimeField(field, dateFormat);
}
//# sourceMappingURL=convertFieldType.js.map