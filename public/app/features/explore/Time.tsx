import { css, cx } from '@emotion/css';
import React, { FC } from 'react';

import { toDuration, GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

export interface TimeProps {
  timeInMs: number;
  className?: string;
  humanize?: boolean;
}

export const Time: FC<TimeProps> = ({ timeInMs, className, humanize }) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  return <span className={cx(styles.elapsedTime, className)}>{formatTime(timeInMs, humanize)}</span>;
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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    elapsedTime: css`
      //text-align: center;
    `,
  };
};

// ${theme.typography.bodySmall.fontSize};
// ${theme.spacing(1)}
