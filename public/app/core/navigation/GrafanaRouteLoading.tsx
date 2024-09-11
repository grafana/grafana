import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { BouncingLoader } from '../components/BouncingLoader/BouncingLoader';

export function GrafanaRouteLoading() {
  const styles = useStyles2(getStyles);

  return (
    <div
      className={cx({
        [styles.loadingPage]: !config.featureToggles.bodyScrolling,
        [styles.loadingPageBodyScrolling]: config.featureToggles.bodyScrolling,
      })}
    >
      <BouncingLoader />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  loadingPage: css({
    backgroundColor: theme.colors.background.primary,
    height: '100%',
    flexDrection: 'column',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  }),
  loadingPageBodyScrolling: css({
    backgroundColor: theme.colors.background.primary,
    flex: 1,
    flexDrection: 'column',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  }),
});
