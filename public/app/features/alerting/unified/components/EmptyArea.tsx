import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export const EmptyArea = ({ children }: React.PropsWithChildren<{}>) => {
  const styles = useStyles2(getStyles);

  return <div className={styles.container}>{children}</div>;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      background-color: ${theme.colors.background.secondary};
      color: ${theme.colors.text.secondary};
      padding: ${theme.spacing(4)};
      text-align: center;
    `,
  };
};
