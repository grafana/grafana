import { css, cx } from '@emotion/css';

import {
  type GrafanaTheme2,
  type TimeZone,
  InternalTimeZones,
  getTimeZone,
  getTimeZoneOffsetMinutes,
  guessBrowserTimeZone,
  isValidTimeZone,
} from '@grafana/data';

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

  return (
    <>
      <span className={cx(styles.offset, className)}>{formatUtcOffset(timestamp, timeZone)}</span>
    </>
  );
};

export const formatUtcOffset = (timestamp: number, timeZone: TimeZone): string => {
  const ianaName = resolveIanaName(timeZone);

  if (!isValidTimeZone(ianaName)) {
    return 'UTC+00:00';
  }

  const offsetInMins = getTimeZoneOffsetMinutes(ianaName, timestamp);
  const sign = offsetInMins < 0 ? '-' : '+';
  const abs = Math.abs(offsetInMins);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const minutes = String(abs % 60).padStart(2, '0');

  return `UTC${sign}${hours}:${minutes}`;
};

// Resolves Grafana's internal time zones ('', 'browser', 'utc') to a concrete
// IANA name that Intl can understand.
const resolveIanaName = (timeZone: TimeZone): string => {
  switch (timeZone) {
    case InternalTimeZones.utc:
      return 'UTC';
    case InternalTimeZones.localBrowserTime:
      return guessBrowserTimeZone();
    case InternalTimeZones.default: {
      const resolved = getTimeZone();
      // Guard against the resolver handing back the default sentinel again.
      return resolved === InternalTimeZones.default ? guessBrowserTimeZone() : resolveIanaName(resolved);
    }
    default:
      return timeZone;
  }
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
