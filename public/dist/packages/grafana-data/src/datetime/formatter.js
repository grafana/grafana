/* eslint-disable id-blacklist, no-restricted-imports, @typescript-eslint/ban-types */
import moment from 'moment-timezone';
import { systemDateFormats } from './formats';
import { getTimeZone } from './common';
/**
 * Helper function to format date and time according to the specified options. If no options
 * are supplied, then default values are used. For more details, see {@link DateTimeOptionsWithFormat}.
 *
 * @param dateInUtc - date in UTC format, e.g. string formatted with UTC offset, UNIX epoch in seconds etc.
 * @param options
 *
 * @public
 */
export var dateTimeFormat = function (dateInUtc, options) {
    return toTz(dateInUtc, getTimeZone(options)).format(getFormat(options));
};
/**
 * Helper function to format date and time according to the standard ISO format e.g. 2013-02-04T22:44:30.652Z.
 * If no options are supplied, then default values are used. For more details, see {@link DateTimeOptionsWithFormat}.
 *
 * @param dateInUtc - date in UTC format, e.g. string formatted with UTC offset, UNIX epoch in seconds etc.
 * @param options
 *
 * @public
 */
export var dateTimeFormatISO = function (dateInUtc, options) {
    return toTz(dateInUtc, getTimeZone(options)).format();
};
/**
 * Helper function to return elapsed time since passed date. The returned value will be formatted
 * in a human readable format e.g. 4 years ago. If no options are supplied, then default values are used.
 * For more details, see {@link DateTimeOptions}.
 *
 * @param dateInUtc - date in UTC format, e.g. string formatted with UTC offset, UNIX epoch in seconds etc.
 * @param options
 *
 * @public
 */
export var dateTimeFormatTimeAgo = function (dateInUtc, options) {
    return toTz(dateInUtc, getTimeZone(options)).fromNow();
};
/**
 * Helper function to format date and time according to the Grafana default formatting, but it
 * also appends the time zone abbreviation at the end e.g. 2020-05-20 13:37:00 CET. If no options
 * are supplied, then default values are used. For more details please see {@link DateTimeOptions}.
 *
 * @param dateInUtc - date in UTC format, e.g. string formatted with UTC offset, UNIX epoch in seconds etc.
 * @param options
 *
 * @public
 */
export var dateTimeFormatWithAbbrevation = function (dateInUtc, options) {
    return toTz(dateInUtc, getTimeZone(options)).format(systemDateFormats.fullDate + " z");
};
/**
 * Helper function to return only the time zone abbreviation for a given date and time value. If no options
 * are supplied, then default values are used. For more details please see {@link DateTimeOptions}.
 *
 * @param dateInUtc - date in UTC format, e.g. string formatted with UTC offset, UNIX epoch in seconds etc.
 * @param options
 *
 * @public
 */
export var timeZoneAbbrevation = function (dateInUtc, options) {
    return toTz(dateInUtc, getTimeZone(options)).format('z');
};
var getFormat = function (options) {
    var _a, _b;
    if (options === null || options === void 0 ? void 0 : options.defaultWithMS) {
        return (_a = options === null || options === void 0 ? void 0 : options.format) !== null && _a !== void 0 ? _a : systemDateFormats.fullDateMS;
    }
    return (_b = options === null || options === void 0 ? void 0 : options.format) !== null && _b !== void 0 ? _b : systemDateFormats.fullDate;
};
var toTz = function (dateInUtc, timeZone) {
    var date = dateInUtc;
    var zone = moment.tz.zone(timeZone);
    if (zone && zone.name) {
        return moment.utc(date).tz(zone.name);
    }
    switch (timeZone) {
        case 'utc':
            return moment.utc(date);
        default:
            return moment.utc(date).local();
    }
};
//# sourceMappingURL=formatter.js.map