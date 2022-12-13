import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export interface Props {
  children: React.ReactNode;
}

export function PageWithTabs({ children }: Props) {
  const styles = useStyles2(getStyles);

  return <div className={styles.tabsWrapper}>{children}</div>;
}

export function PageWithTabsBody({ children }: Props) {
  const styles = useStyles2(getStyles);

  return <div className={styles.bodyWrapper}>{children}</div>;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    tabsWrapper: css({
      display: 'flex',
      height: '100%',
      flexDirection: 'column',
    }),
    bodyWrapper: css({
      display: 'flex',
      paddingTop: theme.spacing(2),
      flexGrow: 1,
      minHeight: 0,
    }),
  };
};
