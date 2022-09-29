import { css } from '@emotion/css';
import React from 'react';

import { LoadingPlaceholder, useStyles2 } from '@grafana/ui';

export function GrafanaRouteLoading() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.loadingPage}>
      <LoadingPlaceholder text={'Loading...'} />
    </div>
  );
}

const getStyles = () => ({
  loadingPage: css({
    height: '100%',
    flexDrection: 'column',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  }),
});
