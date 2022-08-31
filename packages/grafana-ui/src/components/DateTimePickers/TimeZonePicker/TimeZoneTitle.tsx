import { css } from '@emotion/css';
import React, { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes';

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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    title: css`
      font-weight: ${theme.typography.fontWeightRegular};
      text-overflow: ellipsis;
    `,
  };
};
