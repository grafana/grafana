// Libraries
import { toString, isEmpty, isBoolean } from 'lodash';
// Types
import { FieldType } from '../types/dataFrame';
import { getValueFormat, isBooleanUnit } from '../valueFormats/valueFormats';
import { getValueMappingResult } from '../utils/valueMappings';
import { dateTime, dateTimeParse } from '../datetime';
import { getScaleCalculator } from './scale';
import { anyToNumber } from '../utils/anyToNumber';
// Reasonable units for time
var timeFormats = {
    dateTimeAsIso: true,
    dateTimeAsIsoNoDateIfToday: true,
    dateTimeAsUS: true,
    dateTimeAsUSNoDateIfToday: true,
    dateTimeAsLocal: true,
    dateTimeAsLocalNoDateIfToday: true,
    dateTimeFromNow: true,
};
export function getDisplayProcessor(options) {
    var _a;
    if (!options || isEmpty(options) || !options.field) {
        return toStringProcessor;
    }
    var field = options.field;
    var config = (_a = field.config) !== null && _a !== void 0 ? _a : {};
    var unit = config.unit;
    var hasDateUnit = unit && (timeFormats[unit] || unit.startsWith('time:'));
    var showMs = false;
    if (field.type === FieldType.time && !hasDateUnit) {
        unit = "dateTimeAsSystem";
        hasDateUnit = true;
        if (field.values && field.values.length > 1) {
            var start = field.values.get(0);
            var end = field.values.get(field.values.length - 1);
            if (typeof start === 'string') {
                start = dateTimeParse(start).unix();
                end = dateTimeParse(end).unix();
            }
            else {
                start /= 1e3;
                end /= 1e3;
            }
            showMs = end - start < 60; //show ms when minute or less
        }
    }
    else if (field.type === FieldType.boolean) {
        if (!isBooleanUnit(unit)) {
            unit = 'bool';
        }
    }
    var formatFunc = getValueFormat(unit || 'none');
    var scaleFunc = getScaleCalculator(field, options.theme);
    return function (value) {
        var mappings = config.mappings;
        var isStringUnit = unit === 'string';
        if (hasDateUnit && typeof value === 'string') {
            value = dateTime(value).valueOf();
        }
        var numeric = isStringUnit ? NaN : anyToNumber(value);
        var text;
        var prefix;
        var suffix;
        var color;
        var percent;
        if (mappings && mappings.length > 0) {
            var mappingResult = getValueMappingResult(mappings, value);
            if (mappingResult) {
                if (mappingResult.text != null) {
                    text = mappingResult.text;
                }
                if (mappingResult.color != null) {
                    color = options.theme.visualization.getColorByName(mappingResult.color);
                }
            }
        }
        if (!isNaN(numeric)) {
            if (text == null && !isBoolean(value)) {
                var v = formatFunc(numeric, config.decimals, null, options.timeZone, showMs);
                text = v.text;
                suffix = v.suffix;
                prefix = v.prefix;
            }
            // Return the value along with scale info
            if (color == null) {
                var scaleResult = scaleFunc(numeric);
                color = scaleResult.color;
                percent = scaleResult.percent;
            }
        }
        if (text == null) {
            text = toString(value);
            if (!text) {
                if (config.noValue) {
                    text = config.noValue;
                }
                else {
                    text = ''; // No data?
                }
            }
        }
        if (!color) {
            var scaleResult = scaleFunc(-Infinity);
            color = scaleResult.color;
            percent = scaleResult.percent;
        }
        return { text: text, numeric: numeric, prefix: prefix, suffix: suffix, color: color, percent: percent };
    };
}
function toStringProcessor(value) {
    return { text: toString(value), numeric: anyToNumber(value) };
}
export function getRawDisplayProcessor() {
    return function (value) { return ({
        text: "" + value,
        numeric: null,
    }); };
}
//# sourceMappingURL=displayProcessor.js.map