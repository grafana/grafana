import React, { FC } from 'react';

import { toDuration } from '@grafana/data';

export interface TimeProps {
  timeInMs: number;
  className?: string;
  humanize?: boolean;
}

export const Time: FC<TimeProps> = ({ timeInMs, className, humanize }) => {
  return <span className={className}>{formatTime(timeInMs, humanize)}</span>;
};

const formatTime = (timeInMs: number, humanize = false): string => {
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
