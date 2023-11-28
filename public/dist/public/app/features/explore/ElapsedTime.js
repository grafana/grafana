import React, { useState, useEffect } from 'react';
import { useInterval } from 'react-use';
import { Time } from './Time';
const INTERVAL = 150;
export const ElapsedTime = ({ resetKey, humanize, className }) => {
    const [elapsed, setElapsed] = useState(0); // the current value of elapsed
    // hook that will schedule a interval and then update the elapsed value on every tick.
    useInterval(() => setElapsed(elapsed + INTERVAL), INTERVAL);
    // this effect will only be run when resetKey changes. This will reset the elapsed to 0.
    useEffect(() => setElapsed(0), [resetKey]);
    return React.createElement(Time, { timeInMs: elapsed, className: className, humanize: humanize });
};
//# sourceMappingURL=ElapsedTime.js.map