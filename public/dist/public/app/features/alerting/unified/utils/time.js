import { parseDuration, durationToMilliseconds } from '@grafana/data';
import { describeInterval } from '@grafana/data/src/datetime/rangeutil';
import { TimeOptions } from '../types/time';
/**
 * ⚠️
 * Some of these functions might be confusing, but there is a significant difference between "Golang duration",
 * supported by the time.ParseDuration() function and "prometheus duration" which is similar but does not support anything
 * smaller than seconds and adds the following supported units: "d, w, y"
 */
export function parseInterval(value) {
    const match = value.match(/(\d+)(\w+)/);
    if (match) {
        return [Number(match[1]), match[2]];
    }
    throw new Error(`Invalid interval description: ${value}`);
}
export function intervalToSeconds(interval) {
    const { sec, count } = describeInterval(interval);
    return sec * count;
}
export const timeOptions = Object.entries(TimeOptions).map(([key, value]) => ({
    label: key[0].toUpperCase() + key.slice(1),
    value: value,
}));
export function isValidPrometheusDuration(duration) {
    try {
        parsePrometheusDuration(duration);
        return true;
    }
    catch (err) {
        return false;
    }
}
const PROMETHEUS_SUFFIX_MULTIPLIER = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    y: 365 * 24 * 60 * 60 * 1000,
};
const DURATION_REGEXP = new RegExp(/^(?:(?<value>\d+)(?<type>ms|s|m|h|d|w|y))|0$/);
// @PERCONA
const INVALID_FORMAT_MESSAGE = `Must be of format "(number)(unit)", for example "1m", or just "0". Available units: ${Object.values(TimeOptions).join(', ')}`;
const INVALID_FORMAT = new Error(INVALID_FORMAT_MESSAGE);
/**
 * According to https://prometheus.io/docs/alerting/latest/configuration/#configuration-file
 * see <duration>
 *
 * @returns Duration in milliseconds
 */
export function parsePrometheusDuration(duration) {
    let input = duration;
    let parts = [];
    function matchDuration(part) {
        var _a, _b, _c, _d;
        const match = DURATION_REGEXP.exec(part);
        const hasValueAndType = ((_a = match === null || match === void 0 ? void 0 : match.groups) === null || _a === void 0 ? void 0 : _a.value) && ((_b = match === null || match === void 0 ? void 0 : match.groups) === null || _b === void 0 ? void 0 : _b.type);
        if (!match || !hasValueAndType) {
            throw INVALID_FORMAT;
        }
        if (match && ((_c = match.groups) === null || _c === void 0 ? void 0 : _c.value) && ((_d = match.groups) === null || _d === void 0 ? void 0 : _d.type)) {
            input = input.replace(match[0], '');
            parts.push([Number(match.groups.value), match.groups.type]);
        }
        if (input) {
            matchDuration(input);
        }
    }
    matchDuration(duration);
    if (!parts.length) {
        throw INVALID_FORMAT;
    }
    const totalDuration = parts.reduce((acc, [value, type]) => {
        const duration = value * PROMETHEUS_SUFFIX_MULTIPLIER[type];
        return acc + duration;
    }, 0);
    return totalDuration;
}
export const safeParseDurationstr = (duration) => {
    try {
        return parsePrometheusDuration(duration);
    }
    catch (e) {
        return 0;
    }
};
export const isNullDate = (date) => {
    return date.includes('0001-01-01T00');
};
// Format given time span in MS to the largest single unit duration string up to hours.
export function msToSingleUnitDuration(rangeMs) {
    if (rangeMs % (1000 * 60 * 60) === 0) {
        return rangeMs / (1000 * 60 * 60) + 'h';
    }
    if (rangeMs % (1000 * 60) === 0) {
        return rangeMs / (1000 * 60) + 'm';
    }
    if (rangeMs % 1000 === 0) {
        return rangeMs / 1000 + 's';
    }
    return rangeMs.toFixed() + 'ms';
}
// @PERCONA
// 1h, 10m or 0 (without units)
export const durationValidationPattern = {
    value: new RegExp(`^(\\d+(${Object.values(TimeOptions).join('|')})|0)$`),
    message: INVALID_FORMAT_MESSAGE,
};
// @PERCONA
// backport from previous version
export function parseDurationToMilliseconds(duration) {
    return durationToMilliseconds(parseDuration(duration));
}
//# sourceMappingURL=time.js.map