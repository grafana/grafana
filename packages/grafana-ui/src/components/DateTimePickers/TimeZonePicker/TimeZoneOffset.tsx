import { css, cx } from '@emotion/css';

import { type GrafanaTheme2, type TimeZone } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';

import { findTimeZoneAt, resolveIanaName } from './timeZoneUtils';

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
  const tz = findTimeZoneAt(resolveIanaName(timeZone), timestamp);
  return `UTC${tz?.offset ?? '+00:00'}`;
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
