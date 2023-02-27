import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export const HistoryTab = () => {
  const styles = useStyles2(getStyles);

  // @TODO Implement history
  return (
    <div className={styles.wrap}>
      <p className={styles.tabDescription}>No history.</p>
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrap: css`
      padding: 20px 5px 5px 5px;
    `,
    tabDescription: css`
      color: ${theme.colors.text.secondary};
    `,
  };
};
