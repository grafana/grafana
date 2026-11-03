import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type TimeZoneInfo, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../../themes/ThemeContext';

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

export const getTimeZoneTitle = (info: TimeZoneInfo): string => {
  if (info.zone === 'browser') {
    return t('grafana-data.timezones.browser-time', 'Browser Time');
  }

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
