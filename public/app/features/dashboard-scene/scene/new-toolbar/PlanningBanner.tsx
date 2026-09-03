import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { Button, Icon, ToolbarButtonRow, useStyles2 } from '@grafana/ui';

import { type DashboardPlanningState } from '../types/dashboard';

/**
 * The action bar for a dashboard plan that has not been built yet: what the plan is, how big it is,
 * and the only two things the user can do with it.
 *
 * It stands in for the dashboard's normal actions rather than sitting beside them. Save, settings
 * and sharing all speak about a dashboard that does not exist yet — the plan on screen is a
 * proposal, and the user's next move is to accept it or throw it away.
 */
export function PlanningBanner({ planning }: { planning: DashboardPlanningState }) {
  const { planTitle, panelCount, onBuild, onDismiss } = planning;
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.banner}>
      <div className={styles.summary}>
        <Icon name="ai-sparkle" />
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
      // Matches the padding DashboardControls gives the bar it is standing in for.
      padding: theme.spacing(1, 0),
    }),
    summary: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      minWidth: 0,
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
  };
}
