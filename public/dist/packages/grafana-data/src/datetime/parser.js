/* eslint-disable id-blacklist, no-restricted-imports, @typescript-eslint/ban-types */
import moment from 'moment-timezone';
import { isDateTime } from './moment_wrapper';
import { getTimeZone } from './common';
import { parse, isValid } from './datemath';
import { lowerCase } from 'lodash';
import { systemDateFormats } from './formats';
/**
 * Helper function to parse a number, text or Date to a DateTime value. If a timeZone is supplied the incoming value
 * is parsed with that timeZone as a base. The only exception to this is if the passed value is in a UTC-based
 * format. Then it will use UTC as the base. If no format is specified the current system format will be assumed.
 *
 * It can also parse the Grafana quick date and time format, e.g. now-6h will be parsed as Date.now() - 6 hours and
 * returned as a valid DateTime value.
 *
 * If no options are supplied, then default values are used. For more details please see {@link DateTimeOptions}.
 *
 * @param value - should be a parsable date and time value
 * @param options
 *
 * @public
 */
export var dateTimeParse = function (value, options) {
    if (isDateTime(value)) {
        return value;
    }
    if (typeof value === 'string') {
        return parseString(value, options);
    }
    return parseOthers(value, options);
};
var parseString = function (value, options) {
    var _a;
    if (value.indexOf('now') !== -1) {
        if (!isValid(value)) {
            return moment();
        }
        var parsed = parse(value, options === null || options === void 0 ? void 0 : options.roundUp, options === null || options === void 0 ? void 0 : options.timeZone, options === null || options === void 0 ? void 0 : options.fiscalYearStartMonth);
        return parsed || moment();
    }
    var timeZone = getTimeZone(options);
    var zone = moment.tz.zone(timeZone);
    var format = (_a = options === null || options === void 0 ? void 0 : options.format) !== null && _a !== void 0 ? _a : systemDateFormats.fullDate;
    if (zone && zone.name) {
        return moment.tz(value, format, zone.name);
    }
    switch (lowerCase(timeZone)) {
        case 'utc':
            return moment.utc(value, format);
        default:
            return moment(value, format);
    }
};
var parseOthers = function (value, options) {
    var date = value;
    var timeZone = getTimeZone(options);
    var zone = moment.tz.zone(timeZone);
    if (zone && zone.name) {
        return moment.tz(date, zone.name);
    }
    switch (lowerCase(timeZone)) {
        case 'utc':
            return moment.utc(date);
        default:
            return moment(date);
    }
};
//# sourceMappingURL=parser.js.map