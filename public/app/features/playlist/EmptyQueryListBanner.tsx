import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

export const EmptyQueryListBanner = () => {
  const styles = useStyles2(getStyles);
  return <div className={styles.noResult}>No playlist found!</div>;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    noResult: css`
      padding: ${theme.spacing(2)};
      background: ${theme.colors.secondary.main};
      font-style: italic;
      margin-top: ${theme.spacing(2)};
    `,
  };
};
