import { css } from '@emotion/css';
import React, { PropsWithChildren } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

/**
 * A wrapper component for interactive tables using RolePicker to enable overflow.
 * Should be removed when the RolePicker component uses portals to render its menu
 */
export const TableWrapper = ({ children }: PropsWithChildren) => {
  const styles = useStyles2(getStyles);
  return <div className={styles.wrapper}>{children}</div>;
};

const getStyles = (theme: GrafanaTheme2) => ({
  // Enable RolePicker overflow
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    overflowX: 'auto',
    overflowY: 'hidden',
    minHeight: '100vh',
    width: '100%',
    '& > div': {
      overflowX: 'unset',
      marginBottom: theme.spacing(2),
    },
  }),
});
