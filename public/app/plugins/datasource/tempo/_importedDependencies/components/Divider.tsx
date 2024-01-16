import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export const Divider = ({ hideLine = false }) => {
  const styles = useStyles2(getStyles);

  if (hideLine) {
    return <hr className={styles.dividerHideLine} />;
  }

  return <hr className={styles.divider} />;
};

const getStyles = (theme: GrafanaTheme2) => ({
  divider: css`
    margin: ${theme.spacing(4, 0)};
  `,
  dividerHideLine: css`
    border: none;
    margin: ${theme.spacing(3, 0)};
  `,
});
