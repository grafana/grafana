import { useMemo, useState } from 'react';

import { store } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useFlagGrafanaPrometheusQueryVariableMigration } from '@grafana/runtime/internal';
import { Alert, Box, Button } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';

import { PromQueryVarMigrationDrawer } from './PromQueryVarMigrationDrawer';
import { detectMigratableVariables } from './detect';

export function getBannerDismissKey(dashboardUid: string): string {
  return `grafana.dashboard.promQueryVarMigrationBanner.dismissed.${dashboardUid}`;
}

interface Props {
  dashboard: DashboardScene;
}

export function PromQueryVarMigrationBanner({ dashboard }: Props) {
  // OpenFeature values load async during boot: evaluate just-in-time inside the component
  const flagEnabled = useFlagGrafanaPrometheusQueryVariableMigration();
  const { uid, meta } = dashboard.useState();
  const [dismissed, setDismissed] = useState(() => (uid ? store.getBool(getBannerDismissKey(uid), false) : false));
  const [hiddenThisSession, setHiddenThisSession] = useState(false);

  const enabled =
    flagEnabled &&
    Boolean(config.featureToggles.dashboardUnifiedDrilldownControls) &&
    Boolean(meta.canEdit || meta.canSave) &&
    Boolean(uid) &&
    !dismissed;

  const candidates = useMemo(() => (enabled ? detectMigratableVariables(dashboard) : []), [enabled, dashboard]);
  const safeCandidateCount = candidates.filter((candidate) => !candidate.disqualified).length;

  if (!enabled || hiddenThisSession || safeCandidateCount === 0) {
    return null;
  }

  const onDismiss = () => {
    if (uid) {
      store.set(getBannerDismissKey(uid), true);
    }
    setDismissed(true);
  };

  const onReview = () => {
    dashboard.showModal(
      new PromQueryVarMigrationDrawer({
        candidates,
        onApplied: () => setHiddenThisSession(true),
      })
    );
  };

  return (
    <Alert
      severity="info"
      title={t(
        'dashboard-scene.variable-migration.banner-title',
        'This dashboard has Prometheus query variables that can be replaced with the drilldown controls'
      )}
      style={{ flex: 0 }}
      onRemove={onDismiss}
    >
      <Trans i18nKey="dashboard-scene.variable-migration.banner-body">
        Label filter and group by variables can be migrated to the unified drilldown control. Nothing changes until you
        review and apply the migration, and the dashboard is only modified when you save it.
      </Trans>
      <Box marginTop={1}>
        <Button variant="primary" size="sm" onClick={onReview}>
          <Trans i18nKey="dashboard-scene.variable-migration.banner-review">Review migration</Trans>
        </Button>
      </Box>
    </Alert>
  );
}
