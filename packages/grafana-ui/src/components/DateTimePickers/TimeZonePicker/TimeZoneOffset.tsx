import { css, cx } from '@emotion/css';
import { isString } from 'lodash';
import React from 'react';

import { GrafanaTheme2, TimeZone, dateTimeFormat } from '@grafana/data';

import { useStyles2 } from '../../../themes';

interface Props {
  timestamp: number;
  timeZone: TimeZone | undefined;
  className?: string;
}

export const TimeZoneOffset = (props: Props) => {
  const { timestamp, timeZone, className } = props;
  const styles = useStyles2(getStyles);

  if (!isString(timeZone)) {
    return null;
  }

  return (
    <>
      <span className={cx(styles.offset, className)}>{formatUtcOffset(timestamp, timeZone)}</span>
    </>
  );
};

export const formatUtcOffset = (timestamp: number, timeZone: TimeZone): string => {
  const offset = dateTimeFormat(timestamp, {
    timeZone,
    format: 'Z',
  });

  if (offset === '+00:00') {
    return 'UTC';
  }
  return `UTC${offset}`;
};

const getStyles = (theme: GrafanaTheme2) => {
  const textBase = css`
    font-weight: normal;
    font-size: ${theme.typography.size.sm};
    color: ${theme.colors.text.secondary};
    white-space: normal;
  `;

  return {
    offset: css`
      ${textBase};
      color: ${theme.colors.text.primary};
      background: ${theme.colors.background.secondary};
      padding: 2px 5px;
      border-radius: 2px;
      margin-left: 4px;
    `,
  };
};
