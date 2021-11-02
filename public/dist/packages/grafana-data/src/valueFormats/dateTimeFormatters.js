var _a;
import { toDuration as duration, toUtc, dateTime } from '../datetime/moment_wrapper';
import { toFixed, toFixedScaled } from './valueFormats';
import { dateTimeFormat, dateTimeFormatTimeAgo, localTimeFormat, systemDateFormats } from '../datetime';
export var Interval;
(function (Interval) {
    Interval["Year"] = "year";
    Interval["Month"] = "month";
    Interval["Week"] = "week";
    Interval["Day"] = "day";
    Interval["Hour"] = "hour";
    Interval["Minute"] = "minute";
    Interval["Second"] = "second";
    Interval["Millisecond"] = "millisecond";
})(Interval || (Interval = {}));
var INTERVALS_IN_SECONDS = (_a = {},
    _a[Interval.Year] = 31536000,
    _a[Interval.Month] = 2592000,
    _a[Interval.Week] = 604800,
    _a[Interval.Day] = 86400,
    _a[Interval.Hour] = 3600,
    _a[Interval.Minute] = 60,
    _a[Interval.Second] = 1,
    _a[Interval.Millisecond] = 0.001,
    _a);
export function toNanoSeconds(size, decimals) {
    if (size === null) {
        return { text: '' };
    }
    if (Math.abs(size) < 1000) {
        return { text: toFixed(size, decimals), suffix: ' ns' };
    }
    else if (Math.abs(size) < 1000000) {
        return toFixedScaled(size / 1000, decimals, ' µs');
    }
    else if (Math.abs(size) < 1000000000) {
        return toFixedScaled(size / 1000000, decimals, ' ms');
    }
    else if (Math.abs(size) < 60000000000) {
        return toFixedScaled(size / 1000000000, decimals, ' s');
    }
    else if (Math.abs(size) < 3600000000000) {
        return toFixedScaled(size / 60000000000, decimals, ' min');
    }
    else if (Math.abs(size) < 86400000000000) {
        return toFixedScaled(size / 3600000000000, decimals, ' hour');
    }
    else {
        return toFixedScaled(size / 86400000000000, decimals, ' day');
    }
}
export function toMicroSeconds(size, decimals) {
    if (size === null) {
        return { text: '' };
    }
    if (Math.abs(size) < 1000) {
        return { text: toFixed(size, decimals), suffix: ' µs' };
    }
    else if (Math.abs(size) < 1000000) {
        return toFixedScaled(size / 1000, decimals, ' ms');
    }
    else {
        return toFixedScaled(size / 1000000, decimals, ' s');
    }
}
export function toMilliSeconds(size, decimals, scaledDecimals) {
    if (size === null) {
        return { text: '' };
    }
    if (Math.abs(size) < 1000) {
        return { text: toFixed(size, decimals), suffix: ' ms' };
    }
    else if (Math.abs(size) < 60000) {
        // Less than 1 min
        return toFixedScaled(size / 1000, decimals, ' s');
    }
    else if (Math.abs(size) < 3600000) {
        // Less than 1 hour, divide in minutes
        return toFixedScaled(size / 60000, decimals, ' min');
    }
    else if (Math.abs(size) < 86400000) {
        // Less than one day, divide in hours
        return toFixedScaled(size / 3600000, decimals, ' hour');
    }
    else if (Math.abs(size) < 31536000000) {
        // Less than one year, divide in days
        return toFixedScaled(size / 86400000, decimals, ' day');
    }
    return toFixedScaled(size / 31536000000, decimals, ' year');
}
export function trySubstract(value1, value2) {
    if (value1 !== null && value1 !== undefined && value2 !== null && value2 !== undefined) {
        return value1 - value2;
    }
    return undefined;
}
export function toSeconds(size, decimals) {
    if (size === null) {
        return { text: '' };
    }
    // If 0, use s unit instead of ns
    if (size === 0) {
        return { text: '0', suffix: ' s' };
    }
    // Less than 1 µs, divide in ns
    if (Math.abs(size) < 0.000001) {
        return toFixedScaled(size * 1e9, decimals, ' ns');
    }
    // Less than 1 ms, divide in µs
    if (Math.abs(size) < 0.001) {
        return toFixedScaled(size * 1e6, decimals, ' µs');
    }
    // Less than 1 second, divide in ms
    if (Math.abs(size) < 1) {
        return toFixedScaled(size * 1e3, decimals, ' ms');
    }
    if (Math.abs(size) < 60) {
        return { text: toFixed(size, decimals), suffix: ' s' };
    }
    else if (Math.abs(size) < 3600) {
        // Less than 1 hour, divide in minutes
        return toFixedScaled(size / 60, decimals, ' min');
    }
    else if (Math.abs(size) < 86400) {
        // Less than one day, divide in hours
        return toFixedScaled(size / 3600, decimals, ' hour');
    }
    else if (Math.abs(size) < 604800) {
        // Less than one week, divide in days
        return toFixedScaled(size / 86400, decimals, ' day');
    }
    else if (Math.abs(size) < 31536000) {
        // Less than one year, divide in week
        return toFixedScaled(size / 604800, decimals, ' week');
    }
    return toFixedScaled(size / 3.15569e7, decimals, ' year');
}
export function toMinutes(size, decimals) {
    if (size === null) {
        return { text: '' };
    }
    if (Math.abs(size) < 60) {
        return { text: toFixed(size, decimals), suffix: ' min' };
    }
    else if (Math.abs(size) < 1440) {
        return toFixedScaled(size / 60, decimals, ' hour');
    }
    else if (Math.abs(size) < 10080) {
        return toFixedScaled(size / 1440, decimals, ' day');
    }
    else if (Math.abs(size) < 604800) {
        return toFixedScaled(size / 10080, decimals, ' week');
    }
    else {
        return toFixedScaled(size / 5.25948e5, decimals, ' year');
    }
}
export function toHours(size, decimals) {
    if (size === null) {
        return { text: '' };
    }
    if (Math.abs(size) < 24) {
        return { text: toFixed(size, decimals), suffix: ' hour' };
    }
    else if (Math.abs(size) < 168) {
        return toFixedScaled(size / 24, decimals, ' day');
    }
    else if (Math.abs(size) < 8760) {
        return toFixedScaled(size / 168, decimals, ' week');
    }
    else {
        return toFixedScaled(size / 8760, decimals, ' year');
    }
}
export function toDays(size, decimals) {
    if (size === null) {
        return { text: '' };
    }
    if (Math.abs(size) < 7) {
        return { text: toFixed(size, decimals), suffix: ' day' };
    }
    else if (Math.abs(size) < 365) {
        return toFixedScaled(size / 7, decimals, ' week');
    }
    else {
        return toFixedScaled(size / 365, decimals, ' year');
    }
}
export function toDuration(size, decimals, timeScale) {
    if (size === null) {
        return { text: '' };
    }
    if (size === 0) {
        return { text: '0', suffix: ' ' + timeScale + 's' };
    }
    if (size < 0) {
        var v = toDuration(-size, decimals, timeScale);
        if (!v.suffix) {
            v.suffix = '';
        }
        v.suffix += ' ago';
        return v;
    }
    var units = [
        { long: Interval.Year },
        { long: Interval.Month },
        { long: Interval.Week },
        { long: Interval.Day },
        { long: Interval.Hour },
        { long: Interval.Minute },
        { long: Interval.Second },
        { long: Interval.Millisecond },
    ];
    // convert $size to milliseconds
    // intervals_in_seconds uses seconds (duh), convert them to milliseconds here to minimize floating point errors
    size *= INTERVALS_IN_SECONDS[timeScale] * 1000;
    var strings = [];
    // after first value >= 1 print only $decimals more
    var decrementDecimals = false;
    var decimalsCount = 0;
    if (decimals !== null && decimals !== undefined) {
        decimalsCount = decimals;
    }
    for (var i = 0; i < units.length && decimalsCount >= 0; i++) {
        var interval = INTERVALS_IN_SECONDS[units[i].long] * 1000;
        var value = size / interval;
        if (value >= 1 || decrementDecimals) {
            decrementDecimals = true;
            var floor = Math.floor(value);
            var unit = units[i].long + (floor !== 1 ? 's' : '');
            strings.push(floor + ' ' + unit);
            size = size % interval;
            decimalsCount--;
        }
    }
    return { text: strings.join(', ') };
}
export function toClock(size, decimals) {
    if (size === null) {
        return { text: '' };
    }
    // < 1 second
    if (size < 1000) {
        return {
            text: toUtc(size).format('SSS\\m\\s'),
        };
    }
    // < 1 minute
    if (size < 60000) {
        var format_1 = 'ss\\s:SSS\\m\\s';
        if (decimals === 0) {
            format_1 = 'ss\\s';
        }
        return { text: toUtc(size).format(format_1) };
    }
    // < 1 hour
    if (size < 3600000) {
        var format_2 = 'mm\\m:ss\\s:SSS\\m\\s';
        if (decimals === 0) {
            format_2 = 'mm\\m';
        }
        else if (decimals === 1) {
            format_2 = 'mm\\m:ss\\s';
        }
        return { text: toUtc(size).format(format_2) };
    }
    var format = 'mm\\m:ss\\s:SSS\\m\\s';
    var hours = ('0' + Math.floor(duration(size, 'milliseconds').asHours())).slice(-2) + "h";
    if (decimals === 0) {
        format = '';
    }
    else if (decimals === 1) {
        format = 'mm\\m';
    }
    else if (decimals === 2) {
        format = 'mm\\m:ss\\s';
    }
    var text = format ? hours + ":" + toUtc(size).format(format) : hours;
    return { text: text };
}
export function toDurationInMilliseconds(size, decimals) {
    return toDuration(size, decimals, Interval.Millisecond);
}
export function toDurationInSeconds(size, decimals) {
    return toDuration(size, decimals, Interval.Second);
}
export function toDurationInHoursMinutesSeconds(size) {
    if (size < 0) {
        var v = toDurationInHoursMinutesSeconds(-size);
        if (!v.suffix) {
            v.suffix = '';
        }
        v.suffix += ' ago';
        return v;
    }
    var strings = [];
    var numHours = Math.floor(size / 3600);
    var numMinutes = Math.floor((size % 3600) / 60);
    var numSeconds = Math.floor((size % 3600) % 60);
    numHours > 9 ? strings.push('' + numHours) : strings.push('0' + numHours);
    numMinutes > 9 ? strings.push('' + numMinutes) : strings.push('0' + numMinutes);
    numSeconds > 9 ? strings.push('' + numSeconds) : strings.push('0' + numSeconds);
    return { text: strings.join(':') };
}
export function toDurationInDaysHoursMinutesSeconds(size) {
    if (size < 0) {
        var v = toDurationInDaysHoursMinutesSeconds(-size);
        if (!v.suffix) {
            v.suffix = '';
        }
        v.suffix += ' ago';
        return v;
    }
    var dayString = '';
    var numDays = Math.floor(size / (24 * 3600));
    if (numDays > 0) {
        dayString = numDays + ' d ';
    }
    var hmsString = toDurationInHoursMinutesSeconds(size - numDays * 24 * 3600);
    return { text: dayString + hmsString.text };
}
export function toTimeTicks(size, decimals) {
    return toSeconds(size / 100, decimals);
}
export function toClockMilliseconds(size, decimals) {
    return toClock(size, decimals);
}
export function toClockSeconds(size, decimals) {
    return toClock(size * 1000, decimals);
}
export function toDateTimeValueFormatter(pattern, todayPattern) {
    return function (value, decimals, scaledDecimals, timeZone) {
        if (todayPattern) {
            if (dateTime().isSame(value, 'day')) {
                return {
                    text: dateTimeFormat(value, { format: todayPattern, timeZone: timeZone }),
                };
            }
        }
        return { text: dateTimeFormat(value, { format: pattern, timeZone: timeZone }) };
    };
}
export var dateTimeAsIso = toDateTimeValueFormatter('YYYY-MM-DD HH:mm:ss');
export var dateTimeAsIsoNoDateIfToday = toDateTimeValueFormatter('YYYY-MM-DD HH:mm:ss', 'HH:mm:ss');
export var dateTimeAsUS = toDateTimeValueFormatter('MM/DD/YYYY h:mm:ss a');
export var dateTimeAsUSNoDateIfToday = toDateTimeValueFormatter('MM/DD/YYYY h:mm:ss a', 'h:mm:ss a');
export function getDateTimeAsLocalFormat() {
    return toDateTimeValueFormatter(localTimeFormat({
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }));
}
export function getDateTimeAsLocalFormatNoDateIfToday() {
    return toDateTimeValueFormatter(localTimeFormat({
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }), localTimeFormat({
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }));
}
export function dateTimeSystemFormatter(value, decimals, scaledDecimals, timeZone, showMs) {
    return {
        text: dateTimeFormat(value, {
            format: showMs ? systemDateFormats.fullDateMS : systemDateFormats.fullDate,
            timeZone: timeZone,
        }),
    };
}
export function dateTimeFromNow(value, decimals, scaledDecimals, timeZone) {
    return { text: dateTimeFormatTimeAgo(value, { timeZone: timeZone }) };
}
//# sourceMappingURL=dateTimeFormatters.js.map