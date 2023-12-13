import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { BouncingLoader } from '../components/BouncingLoader/BouncingLoader';

export function GrafanaRouteLoading() {
  const styles = useStyles2(getStyles);

  return (
    <div
      className={cx(styles.loadingPage, {
        [styles.loadingPageDockedNav]: config.featureToggles.dockedMegaMenu,
      })}
    >
      <BouncingLoader />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  loadingPage: css({
    height: '100%',
    flexDrection: 'column',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  }),
  loadingPageDockedNav: css({
    backgroundColor: theme.colors.background.primary,
  }),
});
