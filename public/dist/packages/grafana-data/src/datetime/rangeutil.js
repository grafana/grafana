import { each, has } from 'lodash';
import * as dateMath from './datemath';
import { isDateTime, dateTime } from './moment_wrapper';
import { timeZoneAbbrevation, dateTimeFormat, dateTimeFormatTimeAgo } from './formatter';
import { dateTimeParse } from './parser';
var spans = {
    s: { display: 'second' },
    m: { display: 'minute' },
    h: { display: 'hour' },
    d: { display: 'day' },
    w: { display: 'week' },
    M: { display: 'month' },
    y: { display: 'year' },
};
var rangeOptions = [
    { from: 'now/d', to: 'now/d', display: 'Today' },
    { from: 'now/d', to: 'now', display: 'Today so far' },
    { from: 'now/w', to: 'now/w', display: 'This week' },
    { from: 'now/w', to: 'now', display: 'This week so far' },
    { from: 'now/M', to: 'now/M', display: 'This month' },
    { from: 'now/M', to: 'now', display: 'This month so far' },
    { from: 'now/y', to: 'now/y', display: 'This year' },
    { from: 'now/y', to: 'now', display: 'This year so far' },
    { from: 'now-1d/d', to: 'now-1d/d', display: 'Yesterday' },
    {
        from: 'now-2d/d',
        to: 'now-2d/d',
        display: 'Day before yesterday',
    },
    {
        from: 'now-7d/d',
        to: 'now-7d/d',
        display: 'This day last week',
    },
    { from: 'now-1w/w', to: 'now-1w/w', display: 'Previous week' },
    { from: 'now-1M/M', to: 'now-1M/M', display: 'Previous month' },
    { from: 'now-1Q/fQ', to: 'now-1Q/fQ', display: 'Previous fiscal quarter' },
    { from: 'now-1y/y', to: 'now-1y/y', display: 'Previous year' },
    { from: 'now-1y/fy', to: 'now-1y/fy', display: 'Previous fiscal year' },
    { from: 'now-5m', to: 'now', display: 'Last 5 minutes' },
    { from: 'now-15m', to: 'now', display: 'Last 15 minutes' },
    { from: 'now-30m', to: 'now', display: 'Last 30 minutes' },
    { from: 'now-1h', to: 'now', display: 'Last 1 hour' },
    { from: 'now-3h', to: 'now', display: 'Last 3 hours' },
    { from: 'now-6h', to: 'now', display: 'Last 6 hours' },
    { from: 'now-12h', to: 'now', display: 'Last 12 hours' },
    { from: 'now-24h', to: 'now', display: 'Last 24 hours' },
    { from: 'now-2d', to: 'now', display: 'Last 2 days' },
    { from: 'now-7d', to: 'now', display: 'Last 7 days' },
    { from: 'now-30d', to: 'now', display: 'Last 30 days' },
    { from: 'now-90d', to: 'now', display: 'Last 90 days' },
    { from: 'now-6M', to: 'now', display: 'Last 6 months' },
    { from: 'now-1y', to: 'now', display: 'Last 1 year' },
    { from: 'now-2y', to: 'now', display: 'Last 2 years' },
    { from: 'now-5y', to: 'now', display: 'Last 5 years' },
    { from: 'now/fQ', to: 'now', display: 'This fiscal quarter so far' },
    { from: 'now/fQ', to: 'now/fQ', display: 'This fiscal quarter' },
    { from: 'now/fy', to: 'now', display: 'This fiscal year so far' },
    { from: 'now/fy', to: 'now/fy', display: 'This fiscal year' },
];
var hiddenRangeOptions = [
    { from: 'now', to: 'now+1m', display: 'Next minute' },
    { from: 'now', to: 'now+5m', display: 'Next 5 minutes' },
    { from: 'now', to: 'now+15m', display: 'Next 15 minutes' },
    { from: 'now', to: 'now+30m', display: 'Next 30 minutes' },
    { from: 'now', to: 'now+1h', display: 'Next hour' },
    { from: 'now', to: 'now+3h', display: 'Next 3 hours' },
    { from: 'now', to: 'now+6h', display: 'Next 6 hours' },
    { from: 'now', to: 'now+12h', display: 'Next 12 hours' },
    { from: 'now', to: 'now+24h', display: 'Next 24 hours' },
    { from: 'now', to: 'now+2d', display: 'Next 2 days' },
    { from: 'now', to: 'now+7d', display: 'Next 7 days' },
    { from: 'now', to: 'now+30d', display: 'Next 30 days' },
    { from: 'now', to: 'now+90d', display: 'Next 90 days' },
    { from: 'now', to: 'now+6M', display: 'Next 6 months' },
    { from: 'now', to: 'now+1y', display: 'Next year' },
    { from: 'now', to: 'now+2y', display: 'Next 2 years' },
    { from: 'now', to: 'now+5y', display: 'Next 5 years' },
];
var rangeIndex = {};
each(rangeOptions, function (frame) {
    rangeIndex[frame.from + ' to ' + frame.to] = frame;
});
each(hiddenRangeOptions, function (frame) {
    rangeIndex[frame.from + ' to ' + frame.to] = frame;
});
// handles expressions like
// 5m
// 5m to now/d
// now/d to now
// now/d
// if no to <expr> then to now is assumed
export function describeTextRange(expr) {
    var isLast = expr.indexOf('+') !== 0;
    if (expr.indexOf('now') === -1) {
        expr = (isLast ? 'now-' : 'now') + expr;
    }
    var opt = rangeIndex[expr + ' to now'];
    if (opt) {
        return opt;
    }
    if (isLast) {
        opt = { from: expr, to: 'now' };
    }
    else {
        opt = { from: 'now', to: expr };
    }
    var parts = /^now([-+])(\d+)(\w)/.exec(expr);
    if (parts) {
        var unit = parts[3];
        var amount = parseInt(parts[2], 10);
        var span = spans[unit];
        if (span) {
            opt.display = isLast ? 'Last ' : 'Next ';
            opt.display += amount + ' ' + span.display;
            opt.section = span.section;
            if (amount > 1) {
                opt.display += 's';
            }
        }
    }
    else {
        opt.display = opt.from + ' to ' + opt.to;
        opt.invalid = true;
    }
    return opt;
}
/**
 * Use this function to get a properly formatted string representation of a {@link @grafana/data:RawTimeRange | range}.
 *
 * @example
 * ```
 * // Prints "2":
 * console.log(add(1,1));
 * ```
 * @category TimeUtils
 * @param range - a time range (usually specified by the TimePicker)
 * @alpha
 */
export function describeTimeRange(range, timeZone) {
    var option = rangeIndex[range.from.toString() + ' to ' + range.to.toString()];
    if (option) {
        return option.display;
    }
    var options = { timeZone: timeZone };
    if (isDateTime(range.from) && isDateTime(range.to)) {
        return dateTimeFormat(range.from, options) + ' to ' + dateTimeFormat(range.to, options);
    }
    if (isDateTime(range.from)) {
        var parsed = dateMath.parse(range.to, true, 'utc');
        return parsed ? dateTimeFormat(range.from, options) + ' to ' + dateTimeFormatTimeAgo(parsed, options) : '';
    }
    if (isDateTime(range.to)) {
        var parsed = dateMath.parse(range.from, false, 'utc');
        return parsed ? dateTimeFormatTimeAgo(parsed, options) + ' to ' + dateTimeFormat(range.to, options) : '';
    }
    if (range.to.toString() === 'now') {
        var res = describeTextRange(range.from);
        return res.display;
    }
    return range.from.toString() + ' to ' + range.to.toString();
}
export var isValidTimeSpan = function (value) {
    if (value.indexOf('$') === 0 || value.indexOf('+$') === 0) {
        return true;
    }
    var info = describeTextRange(value);
    return info.invalid !== true;
};
export var describeTimeRangeAbbreviation = function (range, timeZone) {
    if (isDateTime(range.from)) {
        return timeZoneAbbrevation(range.from, { timeZone: timeZone });
    }
    var parsed = dateMath.parse(range.from, true);
    return parsed ? timeZoneAbbrevation(parsed, { timeZone: timeZone }) : '';
};
export var convertRawToRange = function (raw, timeZone, fiscalYearStartMonth) {
    var from = dateTimeParse(raw.from, { roundUp: false, timeZone: timeZone, fiscalYearStartMonth: fiscalYearStartMonth });
    var to = dateTimeParse(raw.to, { roundUp: true, timeZone: timeZone, fiscalYearStartMonth: fiscalYearStartMonth });
    if (dateMath.isMathString(raw.from) || dateMath.isMathString(raw.to)) {
        return { from: from, to: to, raw: raw };
    }
    return { from: from, to: to, raw: { from: from, to: to } };
};
function isRelativeTime(v) {
    if (typeof v === 'string') {
        return v.indexOf('now') >= 0;
    }
    return false;
}
export function isFiscal(timeRange) {
    if (typeof timeRange.raw.from === 'string' && timeRange.raw.from.indexOf('f') > 0) {
        return true;
    }
    else if (typeof timeRange.raw.to === 'string' && timeRange.raw.to.indexOf('f') > 0) {
        return true;
    }
    return false;
}
export function isRelativeTimeRange(raw) {
    return isRelativeTime(raw.from) || isRelativeTime(raw.to);
}
export function secondsToHms(seconds) {
    var numYears = Math.floor(seconds / 31536000);
    if (numYears) {
        return numYears + 'y';
    }
    var numDays = Math.floor((seconds % 31536000) / 86400);
    if (numDays) {
        return numDays + 'd';
    }
    var numHours = Math.floor(((seconds % 31536000) % 86400) / 3600);
    if (numHours) {
        return numHours + 'h';
    }
    var numMinutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
    if (numMinutes) {
        return numMinutes + 'm';
    }
    var numSeconds = Math.floor((((seconds % 31536000) % 86400) % 3600) % 60);
    if (numSeconds) {
        return numSeconds + 's';
    }
    var numMilliseconds = Math.floor(seconds * 1000.0);
    if (numMilliseconds) {
        return numMilliseconds + 'ms';
    }
    return 'less than a millisecond'; //'just now' //or other string you like;
}
// Format timeSpan (in sec) to string used in log's meta info
export function msRangeToTimeString(rangeMs) {
    var rangeSec = Number((rangeMs / 1000).toFixed());
    var h = Math.floor(rangeSec / 60 / 60);
    var m = Math.floor(rangeSec / 60) - h * 60;
    var s = Number((rangeSec % 60).toFixed());
    var formattedH = h ? h + 'h' : '';
    var formattedM = m ? m + 'min' : '';
    var formattedS = s ? s + 'sec' : '';
    formattedH && formattedM ? (formattedH = formattedH + ' ') : (formattedH = formattedH);
    (formattedM || formattedH) && formattedS ? (formattedM = formattedM + ' ') : (formattedM = formattedM);
    return formattedH + formattedM + formattedS || 'less than 1sec';
}
export function calculateInterval(range, resolution, lowLimitInterval) {
    var lowLimitMs = 1; // 1 millisecond default low limit
    if (lowLimitInterval) {
        lowLimitMs = intervalToMs(lowLimitInterval);
    }
    var intervalMs = roundInterval((range.to.valueOf() - range.from.valueOf()) / resolution);
    if (lowLimitMs > intervalMs) {
        intervalMs = lowLimitMs;
    }
    return {
        intervalMs: intervalMs,
        interval: secondsToHms(intervalMs / 1000),
    };
}
var interval_regex = /(-?\d+(?:\.\d+)?)(ms|[Mwdhmsy])/;
// histogram & trends
var intervals_in_seconds = {
    y: 31536000,
    M: 2592000,
    w: 604800,
    d: 86400,
    h: 3600,
    m: 60,
    s: 1,
    ms: 0.001,
};
export function describeInterval(str) {
    // Default to seconds if no unit is provided
    if (Number(str)) {
        return {
            sec: intervals_in_seconds.s,
            type: 's',
            count: parseInt(str, 10),
        };
    }
    var matches = str.match(interval_regex);
    if (!matches || !has(intervals_in_seconds, matches[2])) {
        throw new Error("Invalid interval string, has to be either unit-less or end with one of the following units: \"" + Object.keys(intervals_in_seconds).join(', ') + "\"");
    }
    return {
        sec: intervals_in_seconds[matches[2]],
        type: matches[2],
        count: parseInt(matches[1], 10),
    };
}
export function intervalToSeconds(str) {
    var info = describeInterval(str);
    return info.sec * info.count;
}
export function intervalToMs(str) {
    var info = describeInterval(str);
    return info.sec * 1000 * info.count;
}
export function roundInterval(interval) {
    switch (true) {
        // 0.015s
        case interval < 15:
            return 10; // 0.01s
        // 0.035s
        case interval < 35:
            return 20; // 0.02s
        // 0.075s
        case interval < 75:
            return 50; // 0.05s
        // 0.15s
        case interval < 150:
            return 100; // 0.1s
        // 0.35s
        case interval < 350:
            return 200; // 0.2s
        // 0.75s
        case interval < 750:
            return 500; // 0.5s
        // 1.5s
        case interval < 1500:
            return 1000; // 1s
        // 3.5s
        case interval < 3500:
            return 2000; // 2s
        // 7.5s
        case interval < 7500:
            return 5000; // 5s
        // 12.5s
        case interval < 12500:
            return 10000; // 10s
        // 17.5s
        case interval < 17500:
            return 15000; // 15s
        // 25s
        case interval < 25000:
            return 20000; // 20s
        // 45s
        case interval < 45000:
            return 30000; // 30s
        // 1.5m
        case interval < 90000:
            return 60000; // 1m
        // 3.5m
        case interval < 210000:
            return 120000; // 2m
        // 7.5m
        case interval < 450000:
            return 300000; // 5m
        // 12.5m
        case interval < 750000:
            return 600000; // 10m
        // 12.5m
        case interval < 1050000:
            return 900000; // 15m
        // 25m
        case interval < 1500000:
            return 1200000; // 20m
        // 45m
        case interval < 2700000:
            return 1800000; // 30m
        // 1.5h
        case interval < 5400000:
            return 3600000; // 1h
        // 2.5h
        case interval < 9000000:
            return 7200000; // 2h
        // 4.5h
        case interval < 16200000:
            return 10800000; // 3h
        // 9h
        case interval < 32400000:
            return 21600000; // 6h
        // 1d
        case interval < 86400000:
            return 43200000; // 12h
        // 1w
        case interval < 604800000:
            return 86400000; // 1d
        // 3w
        case interval < 1814400000:
            return 604800000; // 1w
        // 6w
        case interval < 3628800000:
            return 2592000000; // 30d
        default:
            return 31536000000; // 1y
    }
}
/**
 * Converts a TimeRange to a RelativeTimeRange that can be used in
 * e.g. alerting queries/rules.
 *
 * @internal
 */
export function timeRangeToRelative(timeRange, now) {
    if (now === void 0) { now = dateTime(); }
    var from = now.unix() - timeRange.from.unix();
    var to = now.unix() - timeRange.to.unix();
    return {
        from: from,
        to: to,
    };
}
/**
 * Converts a RelativeTimeRange to a TimeRange
 *
 * @internal
 */
export function relativeToTimeRange(relativeTimeRange, now) {
    if (now === void 0) { now = dateTime(); }
    var from = dateTime(now).subtract(relativeTimeRange.from, 's');
    var to = relativeTimeRange.to === 0 ? dateTime(now) : dateTime(now).subtract(relativeTimeRange.to, 's');
    return {
        from: from,
        to: to,
        raw: { from: from, to: to },
    };
}
//# sourceMappingURL=rangeutil.js.map