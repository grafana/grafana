import React from 'react';
import { toDuration } from '@grafana/data';
export var Time = function (_a) {
    var timeInMs = _a.timeInMs, className = _a.className, humanize = _a.humanize;
    return React.createElement("span", { className: "elapsed-time " + className }, formatTime(timeInMs, humanize));
};
var formatTime = function (timeInMs, humanize) {
    if (humanize === void 0) { humanize = false; }
    var inSeconds = timeInMs / 1000;
    if (!humanize) {
        return inSeconds.toFixed(1) + "s";
    }
    var duration = toDuration(inSeconds, 'seconds');
    var hours = duration.hours();
    var minutes = duration.minutes();
    var seconds = duration.seconds();
    if (hours) {
        return hours + "h " + minutes + "m " + seconds + "s";
    }
    if (minutes) {
        return minutes + "m " + seconds + "s";
    }
    return seconds + "s";
};
//# sourceMappingURL=Time.js.map