import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type DashboardScene } from '../DashboardScene';
import { VariableControls } from '../VariableControls';
import { getPlanningGround } from '../planningGround';
import { type DashboardPlanningState } from '../types/dashboard';

import { PlanningBanner } from './PlanningBanner';

/**
 * Compose plan actions and variables so users can review the proposed variables
 * without exposing DashboardControls' save/settings/share actions. Omit the time
 * picker because sample data has no query runner to respond to a time range.
 */
export function PlanningControls({
  dashboard,
  planning,
}: {
  dashboard: DashboardScene;
  planning: DashboardPlanningState;
}) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <div className={styles.banner}>
        <PlanningBanner planning={planning} />
      </div>
      {/*
       * `:empty` in the styles below, rather than asking whether there are visible variables here:
       * VariableControls already owns that rule (hidden variables, in-controls-menu variables,
       * section repeat locals), and a plan with no variables should not gain an empty strip.
       */}
      <div className={styles.variables}>
        <VariableControls dashboard={dashboard} />
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    banner: css({
      padding: theme.spacing(0, 2),
      // The hairline is what the variables sit below, not what the canvas sits below: it separates
      // the plan's chrome from the plan itself.
      borderBottom: `1px solid ${theme.colors.primary.borderTransparent}`,
    }),
    /**
     * Share the canvas background so variables appear as part of the editable plan.
     */
    variables: css({
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'flex-end',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 2),
      ...getPlanningGround(theme),
      '&:empty': {
        display: 'none',
      },
    }),
  };
}
