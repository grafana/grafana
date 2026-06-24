import { css, cx } from '@emotion/css';

import { type GrafanaTheme2, getTimeZoneInfo, getZone } from '@grafana/data';
import { type TimeZone } from '@grafana/schema';

import { useStyles2 } from '../../../themes/ThemeContext';

interface Props {
  timestamp: number;
  timeZone: TimeZone | undefined;
  className?: string;
}

export const TimeZoneOffset = (props: Props) => {
  const { timestamp, timeZone, className } = props;
  const styles = useStyles2(getStyles);

  if (typeof timeZone !== 'string') {
    return null;
  }

  return <span className={cx(styles.offset, className)}>{formatUtcOffset(timestamp, timeZone)}</span>;
};

export const formatUtcOffset = (timestamp: number, timeZone: TimeZone): string => {
  const ianaName = getTimeZoneInfo(timeZone, timestamp)?.ianaName ?? timeZone;
  const offsetInMinutes = getZone(ianaName)?.utcOffset(timestamp);

  if (offsetInMinutes === undefined) {
    return '';
  }

  const sign = offsetInMinutes <= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetInMinutes);
  const hours = String(Math.floor(absoluteOffset / 60)).padStart(2, '0');
  const minutes = String(absoluteOffset % 60).padStart(2, '0');

  return `UTC${sign}${hours}:${minutes}`;
};

const getStyles = (theme: GrafanaTheme2) => {
  const textBase = css({
    fontWeight: 'normal',
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.secondary,
    whiteSpace: 'normal',
  });

  return {
    offset: css(textBase, {
      color: theme.colors.text.primary,
      background: theme.colors.background.secondary,
      padding: '2px 5px',
      borderRadius: theme.shape.radius.default,
      marginLeft: '4px',
    }),
  };
};
