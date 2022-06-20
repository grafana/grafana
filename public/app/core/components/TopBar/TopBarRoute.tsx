import { css } from '@emotion/css';
import React, { PropsWithChildren } from 'react';

import { useStyles2 } from '@grafana/ui';

import { TopBar } from './TopBar';

export function TopBarRoute({ children }: PropsWithChildren<{}>) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <TopBar />
      <div className={styles.route}>{children}</div>
    </div>
  );
}

const getStyles = () => {
  return {
    container: css({
      display: 'flex',
      flexGrow: 1,
      height: '100%',
    }),
    route: css({
      display: 'flex',
      paddingTop: 80,
      flexGrow: 1,
    }),
  };
};
