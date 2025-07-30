import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2, TimeZoneInfo } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';

interface Props {
  info?: TimeZoneInfo;
}

export const TimeZoneDescription = ({ info }: Props) => {
  const styles = useStyles2(getStyles);
  const description = useDescription(info);

  if (!info) {
    return null;
  }

  return <div className={styles.description}>{description}</div>;
};

const useDescription = (info?: TimeZoneInfo): string => {
  return useMemo(() => {
    const parts: string[] = [];

    if (!info) {
      return '';
    }

    if (info.name === 'Europe/Simferopol') {
      // See https://github.com/grafana/grafana/issues/72031
      return 'Ukraine, EEST';
    }

    if (info.countries.length > 0) {
      const country = info.countries[0];
      parts.push(country.name);
    }

    if (info.abbreviation) {
      parts.push(info.abbreviation);
    }

    return parts.join(', ');
  }, [info]);
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
