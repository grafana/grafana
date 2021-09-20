import React from 'react';
import { useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';

export const EmptyQueryListBanner = () => {
  const styles = useStyles(getStyles);
  return <div className={styles.noResult}>No playlist found!</div>;
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    noResult: css`
      padding: ${theme.spacing.md};
      background: ${theme.colors.bg2};
      font-style: italic;
      margin-top: ${theme.spacing.md};
    `,
  };
};
