import { __assign, __read, __values } from "tslib";
import intervalToDuration from 'date-fns/intervalToDuration';
import add from 'date-fns/add';
var durationMap = {
    years: ['y', 'Y', 'years'],
    months: ['M', 'months'],
    weeks: ['w', 'W', 'weeks'],
    days: ['d', 'D', 'days'],
    hours: ['h', 'H', 'hours'],
    minutes: ['m', 'minutes'],
    seconds: ['s', 'S', 'seconds'],
};
/**
 * intervalToAbbreviatedDurationString converts interval to readable duration string
 *
 * @param interval - interval to convert
 * @param includeSeconds - optional, default true. If false, will not include seconds unless interval is less than 1 minute
 *
 * @public
 */
export function intervalToAbbreviatedDurationString(interval, includeSeconds) {
    if (includeSeconds === void 0) { includeSeconds = true; }
    var duration = intervalToDuration(interval);
    return Object.entries(duration).reduce(function (str, _a) {
        var _b = __read(_a, 2), unit = _b[0], value = _b[1];
        if (value && value !== 0 && !(unit === 'seconds' && !includeSeconds && str)) {
            var padding = str !== '' ? ' ' : '';
            return str + ("" + padding + value + durationMap[unit][0]);
        }
        return str;
    }, '');
}
/**
 * parseDuration parses duration string into datefns Duration object
 *
 * @param duration - string to convert. For example '2m', '5h 20s'
 *
 * @public
 */
export function parseDuration(duration) {
    return duration.split(' ').reduce(function (acc, value) {
        var _a;
        var _b;
        var match = value.match(/(\d+)(.+)/);
        if (match === null || match.length !== 3) {
            return acc;
        }
        var key = (_b = Object.entries(durationMap).find(function (_a) {
            var _b = __read(_a, 2), _ = _b[0], abbreviations = _b[1];
            return abbreviations === null || abbreviations === void 0 ? void 0 : abbreviations.includes(match[2]);
        })) === null || _b === void 0 ? void 0 : _b[0];
        return !key ? acc : __assign(__assign({}, acc), (_a = {}, _a[key] = match[1], _a));
    }, {});
}
/**
 * addDurationToDate adds given duration to given date and returns a new Date object
 *
 * @param date - date to add to. Can be either Date object or a number (milliseconds since epoch)
 * @param duration - duration to add. For example '2m', '5h 20s'
 *
 * @public
 */
export function addDurationToDate(date, duration) {
    return add(date, duration);
}
/**
 * durationToMilliseconds convert a duration object to milliseconds
 *
 * @param duration - datefns Duration object
 *
 * @public
 */
export function durationToMilliseconds(duration) {
    var now = new Date();
    return addDurationToDate(now, duration).getTime() - now.getTime();
}
/**
 * isValidDate returns true if given string can be parsed into valid Date object, false otherwise
 *
 * @param dateString - string representation of a date
 *
 * @public
 */
export function isValidDate(dateString) {
    return !isNaN(Date.parse(dateString));
}
/**
 * isValidDuration returns true if the given string can be parsed into a valid Duration object, false otherwise
 *
 * @param durationString - string representation of a duration
 *
 * @public
 */
export function isValidDuration(durationString) {
    var e_1, _a;
    var _b;
    var _loop_1 = function (value) {
        var match = value.match(/(\d+)(.+)/);
        if (match === null || match.length !== 3) {
            return { value: false };
        }
        var key = (_b = Object.entries(durationMap).find(function (_a) {
            var _b = __read(_a, 2), _ = _b[0], abbreviations = _b[1];
            return abbreviations === null || abbreviations === void 0 ? void 0 : abbreviations.includes(match[2]);
        })) === null || _b === void 0 ? void 0 : _b[0];
        if (!key) {
            return { value: false };
        }
    };
    try {
        for (var _c = __values(durationString.trim().split(' ')), _d = _c.next(); !_d.done; _d = _c.next()) {
            var value = _d.value;
            var state_1 = _loop_1(value);
            if (typeof state_1 === "object")
                return state_1.value;
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return true;
}
/**
 * isValidGoDuration returns true if the given string can be parsed into a valid Duration object based on
 * Go's time.parseDuration, false otherwise.
 *
 * Valid time units are "ns", "us" (or "µs"), "ms", "s", "m", "h".
 *
 * Go docs: https://pkg.go.dev/time#ParseDuration
 *
 * @param durationString - string representation of a duration
 *
 * @internal
 */
export function isValidGoDuration(durationString) {
    var e_2, _a;
    var timeUnits = ['h', 'm', 's', 'ms', 'us', 'µs', 'ns'];
    try {
        for (var _b = __values(durationString.trim().split(' ')), _c = _b.next(); !_c.done; _c = _b.next()) {
            var value = _c.value;
            var match = value.match(/(\d+)(.+)/);
            if (match === null || match.length !== 3) {
                return false;
            }
            var isValidUnit = timeUnits.includes(match[2]);
            if (!isValidUnit) {
                return false;
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return true;
}
//# sourceMappingURL=durationutil.js.map