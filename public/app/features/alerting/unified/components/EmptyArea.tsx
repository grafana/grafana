import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '@grafana/ui';

export const EmptyArea = ({ children }: React.PropsWithChildren<{}>) => {
  const styles = useStyles(getStyles);

  return <div className={styles.container}>{children}</div>;
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    container: css`
      background-color: ${theme.colors.bg2};
      color: ${theme.colors.textSemiWeak};
      padding: ${theme.spacing.xl};
      text-align: center;
    `,
  };
};
