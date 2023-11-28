import React from 'react';
import { toDuration } from '@grafana/data';
export const Time = ({ timeInMs, className, humanize }) => {
    return React.createElement("span", { className: className }, formatTime(timeInMs, humanize));
};
const formatTime = (timeInMs, humanize = false) => {
    const inSeconds = timeInMs / 1000;
    if (!humanize) {
        return `${inSeconds.toFixed(1)}s`;
    }
    const duration = toDuration(inSeconds, 'seconds');
    const hours = duration.hours();
    const minutes = duration.minutes();
    const seconds = duration.seconds();
    if (hours) {
        return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
};
//# sourceMappingURL=Time.js.map