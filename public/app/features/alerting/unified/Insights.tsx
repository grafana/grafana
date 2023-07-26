import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export default function GettingStarted() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <div>panel 1</div>
      <div>panel 2</div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
  `,
});
