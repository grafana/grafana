import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

export const ExpandedRow = () => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  return <div className={styles.wrapper}>Hello expanded row</div>;
};

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      position: 'absolute',
      top: '100%',
      width: '100%',
      height: '100px',
      background: 'red',
      zIndex: 1,
    }),
  };
}
