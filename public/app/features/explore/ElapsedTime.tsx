import React, { FC, useState, useEffect } from 'react';
import { useInterval } from 'react-use';

import { Time, TimeProps } from './Time';

const INTERVAL = 150;

export interface ElapsedTimeProps extends Omit<TimeProps, 'timeInMs'> {
  // Use this to reset the timer. Any value is allowed just need to be !== from the previous.
  // Keep in mind things like [] !== [] or {} !== {}.
  resetKey?: any;
}

export const ElapsedTime: FC<ElapsedTimeProps> = ({ resetKey, humanize, className }) => {
  const [elapsed, setElapsed] = useState(0); // the current value of elapsed

  // hook that will schedule a interval and then update the elapsed value on every tick.
  useInterval(() => setElapsed(elapsed + INTERVAL), INTERVAL);
  // this effect will only be run when resetKey changes. This will reset the elapsed to 0.
  useEffect(() => setElapsed(0), [resetKey]);

  return <Time timeInMs={elapsed} className={className} humanize={humanize} />;
};
