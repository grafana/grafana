import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { Badge, Button, Icon, ToolbarButtonRow, useStyles2 } from '@grafana/ui';

import { type DashboardPlanningState } from '../types/dashboard';

/**
 * Plan actions replace normal dashboard actions until the user builds or dismisses
 * the proposal.
 */
export function PlanningBanner({ planning }: { planning: DashboardPlanningState }) {
  const { planTitle, onBuild, onDismiss } = planning;
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.banner}>
      <div className={styles.summary}>
        <Icon name="ai-sparkle" />
        <Badge
          className={styles.planLabel}
          color="blue"
          text={<Trans i18nKey="dashboard.planning-banner.preview-label">Preview</Trans>}
        />
        <span className={styles.planTitle}>{planTitle}</span>
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
      margin: theme.spacing(1, 0),
      padding: theme.spacing(1.5, 2),
      border: `2px solid ${theme.colors.info.subtleBorder}`,
      borderRadius: theme.shape.radius.default,
      backgroundColor: theme.colors.info.subtleBackground,
      color: theme.colors.text.primary,
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
    }),
    planTitle: css({
      fontWeight: theme.typography.fontWeightMedium,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
  };
}
