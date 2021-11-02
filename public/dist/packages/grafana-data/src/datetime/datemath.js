import { includes, isDate } from 'lodash';
import { dateTime, dateTimeForTimeZone, ISO_8601, isDateTime } from './moment_wrapper';
var units = ['y', 'M', 'w', 'd', 'h', 'm', 's', 'Q'];
export function isMathString(text) {
    if (!text) {
        return false;
    }
    if (typeof text === 'string' && (text.substring(0, 3) === 'now' || text.includes('||'))) {
        return true;
    }
    else {
        return false;
    }
}
/**
 * Parses different types input to a moment instance. There is a specific formatting language that can be used
 * if text arg is string. See unit tests for examples.
 * @param text
 * @param roundUp See parseDateMath function.
 * @param timezone Only string 'utc' is acceptable here, for anything else, local timezone is used.
 */
export function parse(text, roundUp, timezone, fiscalYearStartMonth) {
    if (!text) {
        return undefined;
    }
    if (typeof text !== 'string') {
        if (isDateTime(text)) {
            return text;
        }
        if (isDate(text)) {
            return dateTime(text);
        }
        // We got some non string which is not a moment nor Date. TS should be able to check for that but not always.
        return undefined;
    }
    else {
        var time = void 0;
        var mathString = '';
        var index = void 0;
        var parseString = void 0;
        if (text.substring(0, 3) === 'now') {
            time = dateTimeForTimeZone(timezone);
            mathString = text.substring('now'.length);
        }
        else {
            index = text.indexOf('||');
            if (index === -1) {
                parseString = text;
                mathString = ''; // nothing else
            }
            else {
                parseString = text.substring(0, index);
                mathString = text.substring(index + 2);
            }
            // We're going to just require ISO8601 timestamps, k?
            time = dateTime(parseString, ISO_8601);
        }
        if (!mathString.length) {
            return time;
        }
        return parseDateMath(mathString, time, roundUp, fiscalYearStartMonth);
    }
}
/**
 * Checks if text is a valid date which in this context means that it is either a Moment instance or it can be parsed
 * by parse function. See parse function to see what is considered acceptable.
 * @param text
 */
export function isValid(text) {
    var date = parse(text);
    if (!date) {
        return false;
    }
    if (isDateTime(date)) {
        return date.isValid();
    }
    return false;
}
/**
 * Parses math part of the time string and shifts supplied time according to that math. See unit tests for examples.
 * @param mathString
 * @param time
 * @param roundUp If true it will round the time to endOf time unit, otherwise to startOf time unit.
 */
// TODO: Had to revert Andrejs `time: moment.Moment` to `time: any`
export function parseDateMath(mathString, time, roundUp, fiscalYearStartMonth) {
    if (fiscalYearStartMonth === void 0) { fiscalYearStartMonth = 0; }
    var strippedMathString = mathString.replace(/\s/g, '');
    var dateTime = time;
    var i = 0;
    var len = strippedMathString.length;
    while (i < len) {
        var c = strippedMathString.charAt(i++);
        var type = void 0;
        var num = void 0;
        var unit = void 0;
        var isFiscal = false;
        if (c === '/') {
            type = 0;
        }
        else if (c === '+') {
            type = 1;
        }
        else if (c === '-') {
            type = 2;
        }
        else {
            return undefined;
        }
        if (isNaN(parseInt(strippedMathString.charAt(i), 10))) {
            num = 1;
        }
        else if (strippedMathString.length === 2) {
            num = parseInt(strippedMathString.charAt(i), 10);
        }
        else {
            var numFrom = i;
            while (!isNaN(parseInt(strippedMathString.charAt(i), 10))) {
                i++;
                if (i > 10) {
                    return undefined;
                }
            }
            num = parseInt(strippedMathString.substring(numFrom, i), 10);
        }
        if (type === 0) {
            // rounding is only allowed on whole, single, units (eg M or 1M, not 0.5M or 2M)
            if (num !== 1) {
                return undefined;
            }
        }
        unit = strippedMathString.charAt(i++);
        if (unit === 'f') {
            unit = strippedMathString.charAt(i++);
            isFiscal = true;
        }
        if (!includes(units, unit)) {
            return undefined;
        }
        else {
            if (type === 0) {
                if (roundUp) {
                    if (isFiscal) {
                        roundToFiscal(fiscalYearStartMonth, dateTime, unit, roundUp);
                    }
                    else {
                        dateTime.endOf(unit);
                    }
                }
                else {
                    if (isFiscal) {
                        roundToFiscal(fiscalYearStartMonth, dateTime, unit, roundUp);
                    }
                    else {
                        dateTime.startOf(unit);
                    }
                }
            }
            else if (type === 1) {
                dateTime.add(num, unit);
            }
            else if (type === 2) {
                dateTime.subtract(num, unit);
            }
        }
    }
    return dateTime;
}
export function roundToFiscal(fyStartMonth, dateTime, unit, roundUp) {
    switch (unit) {
        case 'y':
            if (roundUp) {
                roundToFiscal(fyStartMonth, dateTime, unit, false).add(11, 'M').endOf('M');
            }
            else {
                dateTime.subtract((dateTime.month() - fyStartMonth + 12) % 12, 'M').startOf('M');
            }
            return dateTime;
        case 'Q':
            if (roundUp) {
                roundToFiscal(fyStartMonth, dateTime, unit, false).add(2, 'M').endOf('M');
            }
            else {
                dateTime.subtract((dateTime.month() - fyStartMonth + 3) % 3, 'M').startOf('M');
            }
            return dateTime;
        default:
            return undefined;
    }
}
//# sourceMappingURL=datemath.js.map