import { UNITS } from './constants';
export const getCronStringFromValues = (period, months, monthDays, weekDays, hours, minutes, humanizeValue) => {
    const newMonths = period === 'year' && months ? months : [];
    const newMonthDays = (period === 'year' || period === 'month') && monthDays ? monthDays : [];
    const newWeekDays = (period === 'year' || period === 'month' || period === 'week') && weekDays ? weekDays : [];
    const newHours = period !== 'minute' && period !== 'hour' && hours ? hours : [];
    const newMinutes = period !== 'minute' && minutes ? minutes : [];
    const parsedArray = parseCronArray([newMinutes, newHours, newMonthDays, newMonths, newWeekDays], humanizeValue);
    return parsedArray.join(' ');
};
const dateSort = (a, b) => a - b;
const fixSunday = (values, unit) => {
    if (unit.type === 'week-days') {
        values = values.map((value) => {
            if (value === 7) {
                return 0;
            }
            return value;
        });
    }
    return values;
};
const outOfRange = (values, unit) => {
    const first = values[0];
    const last = values[values.length - 1];
    if (first < unit.min) {
        return first;
    }
    else if (last > unit.max) {
        return last;
    }
    return;
};
const isFull = (values, unit) => values.length === unit.max - unit.min + 1;
const getStep = (values) => {
    if (values.length > 2) {
        const step = values[1] - values[0];
        if (step > 1) {
            return step;
        }
    }
    return;
};
const isInterval = (values, step) => {
    for (let i = 1; i < values.length; i++) {
        const prev = values[i - 1];
        const value = values[i];
        if (value - prev !== step) {
            return false;
        }
    }
    return true;
};
const isFullInterval = (values, unit, step) => {
    const min = values[0];
    const max = values[values.length - 1];
    const haveAllValues = values.length === (max - min) / step + 1;
    if (min === unit.min && max + step > unit.max && haveAllValues) {
        return true;
    }
    return false;
};
const formatValue = (value, unit, humanize, leadingZero, clockFormat) => {
    let cronPartString = value.toString();
    const { type, alt, min } = unit;
    const needLeadingZero = leadingZero && (leadingZero === true || leadingZero.includes(type));
    const need24HourClock = clockFormat === '24-hour-clock' && (type === 'hours' || type === 'minutes');
    if ((humanize && type === 'week-days') || (humanize && type === 'months')) {
        cronPartString = alt[value - min];
    }
    else if (value < 10 && (needLeadingZero || need24HourClock)) {
        cronPartString = cronPartString.padStart(2, '0');
    }
    if (type === 'hours' && clockFormat === '12-hour-clock') {
        const suffix = value >= 12 ? 'PM' : 'AM';
        let hour = value % 12 || 12;
        if (hour < 10 && needLeadingZero) {
            hour = hour.toString().padStart(2, '0');
        }
        cronPartString = `${hour}${suffix}`;
    }
    return cronPartString;
};
const parsePartArray = (arr, unit) => {
    const values = [...new Set(fixSunday(arr, unit))].sort(dateSort);
    if (values.length === 0) {
        return values;
    }
    const value = outOfRange(values, unit);
    if (typeof value !== 'undefined') {
        throw new Error(`Value "${value}" out of range for ${unit.type}`);
    }
    return values;
};
const toRanges = (values) => {
    const retval = [];
    let startPart = null;
    values.forEach((value, index, self) => {
        if (value !== self[index + 1] - 1) {
            if (startPart !== null) {
                retval.push([startPart, value]);
                startPart = null;
            }
            else {
                retval.push(value);
            }
        }
        else if (startPart === null) {
            startPart = value;
        }
    });
    return retval;
};
const partToString = (cronPart, unit, humanize, leadingZero, clockFormat) => {
    let retval = '';
    if (isFull(cronPart, unit) || cronPart.length === 0) {
        retval = '*';
    }
    else {
        const step = getStep(cronPart);
        if (step && isInterval(cronPart, step)) {
            if (isFullInterval(cronPart, unit, step)) {
                retval = `*/${step}`;
            }
            else {
                retval = `${formatValue(cronPart[0], unit, humanize, leadingZero, clockFormat)}-${formatValue(cronPart[cronPart.length - 1], unit, humanize, leadingZero, clockFormat)}/${step}`;
            }
        }
        else {
            retval = toRanges(cronPart)
                .map((range) => {
                if (Array.isArray(range)) {
                    return `${formatValue(range[0], unit, humanize, leadingZero, clockFormat)}-${formatValue(range[1], unit, humanize, leadingZero, clockFormat)}`;
                }
                return formatValue(range, unit, humanize, leadingZero, clockFormat);
            })
                .join(',');
        }
    }
    return retval;
};
const parseCronArray = (cronArr, humanize) => {
    if (cronArr.length === 5) {
        return cronArr.map((partArr, idx) => {
            const unit = UNITS[idx];
            const parsedArray = parsePartArray(partArr, unit);
            return partToString(parsedArray, unit, humanize);
        });
    }
    throw new Error('Invalid cron array');
};
const replaceAlternatives = (str, min, alt) => {
    if (alt) {
        str = str.toUpperCase();
        for (let i = 0; i < alt.length; i++) {
            str = str.replace(alt[i], `${i + min}`);
        }
    }
    return str;
};
const parseStep = (step, unit) => {
    if (typeof step !== 'undefined') {
        const parsedStep = parseInt(step, 10);
        if (isNaN(parsedStep) || parsedStep < 1) {
            throw new Error(`Invalid interval step value "${step}" for ${unit.type}`);
        }
        return parsedStep;
    }
    return;
};
const range = (start, end) => {
    const array = [];
    for (let i = start; i <= end; i++) {
        array.push(i);
    }
    return array;
};
const parseRange = (rangeStr, context, unit) => {
    const subparts = rangeStr.split('-');
    if (subparts.length === 1) {
        const value = parseInt(subparts[0], 10);
        if (isNaN(value)) {
            throw new Error(`Invalid value "${context}" for ${unit.type}`);
        }
        return [value];
    }
    else if (subparts.length === 2) {
        const minValue = parseInt(subparts[0], 10);
        const maxValue = parseInt(subparts[1], 10);
        if (maxValue <= minValue) {
            throw new Error(`Max range is less than min range in "${rangeStr}" for ${unit.type}`);
        }
        return range(minValue, maxValue);
    }
    else {
        throw new Error(`Invalid value "${rangeStr}" for ${unit.type}`);
    }
};
const applyInterval = (values, step) => {
    if (step) {
        const minVal = values[0];
        values = values.filter((value) => {
            return value % step === minVal % step || value === minVal;
        });
    }
    return values;
};
const parsePartString = (str, unit) => {
    if (str === '*' || str === '*/1') {
        return [];
    }
    const stringParts = str.split('/');
    if (stringParts.length > 2) {
        throw new Error(`Invalid value "${unit.type}"`);
    }
    const rangeString = replaceAlternatives(stringParts[0], unit.min, unit.alt);
    let parsedValues;
    if (rangeString === '*') {
        parsedValues = range(unit.min, unit.max);
    }
    else {
        parsedValues = [
            ...new Set(fixSunday(rangeString
                .split(',')
                .map((range) => {
                return parseRange(range, str, unit);
            })
                .flat(), unit)),
        ].sort(dateSort);
        const value = outOfRange(parsedValues, unit);
        if (typeof value !== 'undefined') {
            throw new Error(`Value "${value}" out of range for ${unit.type}`);
        }
    }
    const step = parseStep(stringParts[1], unit);
    const intervalValues = applyInterval(parsedValues, step);
    if (intervalValues.length === unit.total) {
        return [];
    }
    else if (intervalValues.length === 0) {
        throw new Error(`Empty interval value "${str}" for ${unit.type}`);
    }
    return intervalValues;
};
export const parseCronString = (str) => {
    const parts = str.replace(/\s+/g, ' ').trim().split(' ');
    if (parts.length === 5) {
        return parts.map((partStr, idx) => {
            return parsePartString(partStr, UNITS[idx]);
        });
    }
    throw new Error('Invalid cron string format');
};
export const getPeriodFromCronparts = (cronParts) => {
    if (cronParts[3].length > 0) {
        return 'year';
    }
    else if (cronParts[2].length > 0) {
        return 'month';
    }
    else if (cronParts[4].length > 0) {
        return 'week';
    }
    else if (cronParts[1].length > 0) {
        return 'day';
    }
    else if (cronParts[0].length > 0) {
        return 'hour';
    }
    return 'minute';
};
//# sourceMappingURL=cron.js.map