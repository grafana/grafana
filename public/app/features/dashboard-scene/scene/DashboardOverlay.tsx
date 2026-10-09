import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Drawer, useStyles2 } from '@grafana/ui';

import { DashboardLoadingBar } from './DashboardLoadingBar';
import { type DashboardScene } from './DashboardScene';

export function DashboardOverlay({ dashboard }: { dashboard: DashboardScene }) {
  const { overlay, isOverlayLoading } = dashboard.useState();
  const styles = useStyles2(getStyles);

  if (isOverlayLoading) {
    return (
      <Drawer title={t('dashboard.loading.drawer-title', 'Loading…')} onClose={() => dashboard.closeModal()}>
        <div className={styles.loading}>
          <DashboardLoadingBar label={t('dashboard.loading.drawer', 'Loading drawer')} />
        </div>
      </Drawer>
    );
  }

  return overlay ? <overlay.Component model={overlay} /> : null;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    loading: css({
      // Cancel Drawer body padding so the indicator meets the header divider and both edges.
      margin: theme.spacing(-(theme.components.drawer?.padding ?? 2)),
    }),
  };
}
