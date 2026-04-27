import { css } from '@emotion/css';

import type { TimeZoneInfo } from '@grafana/data/datetime';
import type { GrafanaTheme2 } from '@grafana/data/themes';

import { useStyles2 } from '../../../themes/ThemeContext';

interface Props {
  info?: TimeZoneInfo;
}

export const TimeZoneDescription = ({ info }: Props) => {
  const styles = useStyles2(getStyles);

  if (!info || !info.abbreviation) {
    return null;
  }

  return <div className={styles.description}>{info.abbreviation}</div>;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    description: css({
      fontWeight: 'normal',
      fontSize: theme.typography.size.sm,
      color: theme.colors.text.secondary,
      whiteSpace: 'normal',
      textOverflow: 'ellipsis',
    }),
  };
};
