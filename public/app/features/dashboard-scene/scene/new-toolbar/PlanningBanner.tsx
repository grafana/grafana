import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { Button, Icon, ToolbarButtonRow, useStyles2 } from '@grafana/ui';

import { type DashboardPlanningState } from '../types/dashboard';

/**
 * Plan actions replace normal dashboard actions until the user builds or dismisses
 * the proposal.
 */
export function PlanningBanner({ planning }: { planning: DashboardPlanningState }) {
  const { planTitle, panelCount, onBuild, onDismiss } = planning;
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.banner}>
      <div className={styles.summary}>
        <Icon name="ai-sparkle" />
        <span className={styles.planLabel}>
          <Trans i18nKey="dashboard.planning-banner.plan-label">Plan</Trans>
        </span>
        <span className={styles.planTitle}>{planTitle}</span>
        <span className={styles.panelCount}>
          <Trans
            i18nKey="dashboard.planning-banner.panel-count"
            count={panelCount}
            tOptions={{
              defaultValue_one: '{{count}} panel',
              defaultValue_other: '{{count}} panels',
            }}
          >
            {'{{count}}'} panels
          </Trans>
        </span>
        <span className={styles.stake}>
          <Trans i18nKey="dashboard.planning-banner.nothing-saved">Nothing saved yet</Trans>
        </span>
      </div>
      <ToolbarButtonRow alignment="right">
        <Button
          variant="secondary"
          size="sm"
          onClick={onDismiss}
          data-testid={selectors.components.NavToolbar.editDashboard.planningDismissButton}
        >
          <Trans i18nKey="dashboard.planning-banner.dismiss">Dismiss</Trans>
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onBuild}
          data-testid={selectors.components.NavToolbar.editDashboard.planningBuildButton}
        >
          <Trans i18nKey="dashboard.planning-banner.build">Build</Trans>
        </Button>
      </ToolbarButtonRow>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    banner: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(2),
      // No horizontal padding of its own: each host bar supplies it — the app chrome actions bar
      // in the legacy toolbar, PlanningControls under dashboardNewLayouts.
      padding: theme.spacing(2, 0),
    }),
    summary: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      minWidth: 0,
    }),
    /**
     * Keep the mode label separate so it stays visible when a long title truncates.
     */
    planLabel: css({
      flexShrink: 0,
      padding: theme.spacing(0, 0.75),
      borderRadius: theme.shape.radius.default,
      backgroundColor: theme.colors.primary.transparent,
      color: theme.colors.primary.text,
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    planTitle: css({
      fontWeight: theme.typography.fontWeightMedium,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    panelCount: css({
      color: theme.colors.text.secondary,
      whiteSpace: 'nowrap',
    }),
    stake: css({
      color: theme.colors.text.secondary,
      whiteSpace: 'nowrap',
      '&::before': {
        content: '"\\00b7"',
        margin: theme.spacing(0, 1),
      },
    }),
  };
}
