import { css, cx } from '@emotion/css';

import { type GrafanaTheme2, type TimeZone } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';

import { findTimeZoneAt, resolveIanaName } from './timeZoneUtils';

interface Props {
  /** preformatted display string, e.g. 'UTC+05:30' (see formatUtcOffset) */
  offset: string | undefined;
  className?: string;
}

export const TimeZoneOffset = ({ offset, className }: Props) => {
  const styles = useStyles2(getStyles);

  if (!offset) {
    return null;
  }

  return <span className={cx(styles.offset, className)}>{offset}</span>;
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
