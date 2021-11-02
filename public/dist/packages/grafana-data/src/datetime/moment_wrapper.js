/* eslint-disable id-blacklist, no-restricted-imports, @typescript-eslint/ban-types */
import moment from 'moment';
export var ISO_8601 = moment.ISO_8601;
export var setLocale = function (language) {
    moment.locale(language);
};
export var getLocale = function () {
    return moment.locale();
};
export var getLocaleData = function () {
    return moment.localeData();
};
export var isDateTime = function (value) {
    return moment.isMoment(value);
};
export var toUtc = function (input, formatInput) {
    return moment.utc(input, formatInput);
};
export var toDuration = function (input, unit) {
    // moment built-in types are a bit flaky, for example `isoWeek` is not in the type definition but it's present in the js source.
    return moment.duration(input, unit);
};
export var dateTime = function (input, formatInput) {
    return moment(input, formatInput);
};
export var dateTimeAsMoment = function (input) {
    return dateTime(input);
};
export var dateTimeForTimeZone = function (timezone, input, formatInput) {
    if (timezone === 'utc') {
        return toUtc(input, formatInput);
    }
    return dateTime(input, formatInput);
};
export var getWeekdayIndex = function (day) {
    return moment.weekdays().findIndex(function (wd) { return wd.toLowerCase() === day.toLowerCase(); });
};
export var setWeekStart = function (weekStart) {
    var suffix = '-weekStart';
    var language = getLocale().replace(suffix, '');
    var dow = weekStart ? getWeekdayIndex(weekStart) : -1;
    if (dow !== -1) {
        moment.locale(language + suffix, {
            parentLocale: language,
            week: {
                dow: dow,
            },
        });
    }
    else {
        setLocale(language);
    }
};
//# sourceMappingURL=moment_wrapper.js.map