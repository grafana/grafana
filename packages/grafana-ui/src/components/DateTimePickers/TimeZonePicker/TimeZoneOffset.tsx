import { css, cx } from '@emotion/css';
import { isString } from 'lodash';

import { GrafanaTheme2, TimeZone, dateTimeFormat } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';

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

  return `UTC${offset}`;
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
