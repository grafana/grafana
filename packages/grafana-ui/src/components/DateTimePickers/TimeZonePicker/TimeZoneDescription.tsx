import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2, TimeZoneInfo } from '@grafana/data';

import { useStyles2 } from '../../../themes';

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
    description: css`
      font-weight: normal;
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.text.secondary};
      white-space: normal;
      text-overflow: ellipsis;
    `,
  };
};
