import React, { FC, useEffect, useState } from 'react';

import { dateTimeFormatTimeAgo, DateTimeInput } from '@grafana/data';

export interface Props {
  date: DateTimeInput;
}

export const TimeToNow: FC<Props> = ({ date }) => {
  const setRandom = useState(0)[1];
  useEffect(() => {
    const interval = setInterval(() => setRandom(Math.random()), 1000);
    return () => clearInterval(interval);
  });
  return <span title={String(date)}>{dateTimeFormatTimeAgo(date)}</span>;
};
