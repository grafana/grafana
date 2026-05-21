import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { BouncingLoader } from '../components/BouncingLoader/BouncingLoader';

export function GrafanaRouteLoading() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.loadingPage}>
      <BouncingLoader />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  loadingPage: css({
    backgroundColor: theme.colors.background.page,
    flex: 1,
    flexDrection: 'column',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.shape.radius.lg,
    margin: theme.spacing(0, 0.5, 0, 0.5),
    border: `1px solid ${theme.colors.border.weak}`,
  }),
});
