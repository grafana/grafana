import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { useStyles2 } from '@grafana/ui';

import { BouncingLoader } from '../components/BouncingLoader/BouncingLoader';

export function GrafanaRouteLoading() {
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const styles = useStyles2(getStyles, visualRefreshEnabled);

  return (
    <div className={styles.loadingPage}>
      <BouncingLoader />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, visualRefreshEnabled: boolean) => ({
  loadingPage: css(
    {
      backgroundColor: visualRefreshEnabled ? theme.colors.background.page : theme.colors.background.primary,
      flex: 1,
      flexDrection: 'column',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    visualRefreshEnabled && {
      borderRadius: theme.shape.radius.lg,
      margin: theme.spacing(0, 0.5, 0.5, 0.5),
      border: `1px solid ${theme.colors.border.weak}`,
    }
  ),
});
