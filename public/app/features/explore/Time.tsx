import React, { FC } from 'react';
import { toDuration } from '@grafana/data';

export interface TimeProps {
  time: number;
  className?: string;
  humanize?: boolean;
}

export const Time: FC<TimeProps> = ({ time, className, humanize }) => {
  return <span className={`elapsed-time ${className}`}>{formatTime(time, humanize)}</span>;
};

const formatTime = (time: number, humanize = false): string => {
  if (!humanize) {
    return `${time.toFixed(1)}s`;
  }

  const duration = toDuration(time);
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
