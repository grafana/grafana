import { __read } from "tslib";
import React, { useState, useEffect } from 'react';
import { useInterval } from 'react-use';
import { Time } from './Time';
var INTERVAL = 150;
export var ElapsedTime = function (_a) {
    var resetKey = _a.resetKey, humanize = _a.humanize, className = _a.className;
    var _b = __read(useState(0), 2), elapsed = _b[0], setElapsed = _b[1]; // the current value of elapsed
    // hook that will schedule a interval and then update the elapsed value on every tick.
    useInterval(function () { return setElapsed(elapsed + INTERVAL); }, INTERVAL);
    // this effect will only be run when resetKey changes. This will reset the elapsed to 0.
    useEffect(function () { return setElapsed(0); }, [resetKey]);
    return React.createElement(Time, { timeInMs: elapsed, className: className, humanize: humanize });
};
//# sourceMappingURL=ElapsedTime.js.map