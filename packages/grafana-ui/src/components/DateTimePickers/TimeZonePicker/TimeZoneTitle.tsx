import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';

import { type TimeZoneDisplayInfo } from './timeZoneUtils';

interface Props {
  title: string | ReactNode;
}

export const TimeZoneTitle = ({ title }: Props) => {
  const styles = useStyles2(getStyles);

  if (!title) {
    return null;
  }

  return <span className={styles.title}>{title}</span>;
};

export const getTimeZoneTitle = (info: Pick<TimeZoneDisplayInfo, 'name'>): string => {
  return info.name.split('/').at(-1)!.replace(/_/g, ' ');
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    title: css({
      fontWeight: theme.typography.fontWeightRegular,
      textOverflow: 'ellipsis',
    }),
  };
};
