import { __read } from "tslib";
var regex = /^now$|^now\-(\d{1,10})([wdhms])$/;
export var mapOptionToRelativeTimeRange = function (option) {
    return {
        from: relativeToSeconds(option.from),
        to: relativeToSeconds(option.to),
    };
};
export var mapRelativeTimeRangeToOption = function (range) {
    var from = secondsToRelativeFormat(range.from);
    var to = secondsToRelativeFormat(range.to);
    return { from: from, to: to, display: from + " to " + to };
};
export var isRangeValid = function (relative, now) {
    if (now === void 0) { now = Date.now(); }
    if (!isRelativeFormat(relative)) {
        return {
            isValid: false,
            errorMessage: 'Value not in relative time format.',
        };
    }
    var seconds = relativeToSeconds(relative);
    if (seconds > Math.ceil(now / 1000)) {
        return {
            isValid: false,
            errorMessage: 'Can not enter value prior to January 1, 1970.',
        };
    }
    return { isValid: true };
};
export var isRelativeFormat = function (format) {
    return regex.test(format);
};
var relativeToSeconds = function (relative) {
    var match = regex.exec(relative);
    if (!match || match.length !== 3) {
        return 0;
    }
    var _a = __read(match, 3), value = _a[1], unit = _a[2];
    var parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        return 0;
    }
    return parsed * units[unit];
};
var units = {
    w: 604800,
    d: 86400,
    h: 3600,
    m: 60,
    s: 1,
};
var secondsToRelativeFormat = function (seconds) {
    if (seconds <= 0) {
        return 'now';
    }
    if (seconds >= units.w && seconds % units.w === 0) {
        return "now-" + seconds / units.w + "w";
    }
    if (seconds >= units.d && seconds % units.d === 0) {
        return "now-" + seconds / units.d + "d";
    }
    if (seconds >= units.h && seconds % units.h === 0) {
        return "now-" + seconds / units.h + "h";
    }
    if (seconds >= units.m && seconds % units.m === 0) {
        return "now-" + seconds / units.m + "m";
    }
    return "now-" + seconds + "s";
};
//# sourceMappingURL=utils.js.map