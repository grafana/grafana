import { css } from '@emotion/css';
import React, { PropsWithChildren } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export interface Props extends PropsWithChildren<{}> {}

export function NavToolbarActions({ children }: Props) {
  const styles = useStyles2(getStyles);

  return <div className={styles.actions}>{children}</div>;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    actions: css({
      display: 'flex',
      flexGrow: 1,
    }),
  };
};
