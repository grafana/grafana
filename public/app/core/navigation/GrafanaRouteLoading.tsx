import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

export function GrafanaRouteLoading() {
  const styles = useStyles2(getStyles);

  return (
    <div
      className={cx('preloader', styles.loadingPage, {
        [styles.loadingPageDockedNav]: config.featureToggles.dockedMegaMenu,
      })}
      aria-live="polite"
      role="status"
      aria-label="Loading"
    >
      <div className="preloader__enter">
        <div className="preloader__bounce">
          <div className="preloader__logo"></div>
        </div>
      </div>
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
