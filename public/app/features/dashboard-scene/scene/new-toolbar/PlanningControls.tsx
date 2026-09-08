import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type DashboardScene } from '../DashboardScene';
import { VariableControls } from '../VariableControls';
import { type DashboardPlanningState } from '../types/dashboard';

import { PlanningBanner } from './PlanningBanner';

/**
 * Everything the controls slot holds while a dashboard plan is on screen: the plan's action bar,
 * and the plan's variables.
 *
 * The variables are here because they are part of what the user is being asked to approve — a plan
 * can propose them, the scaffolder creates them, and Build reads them back. Previously this slot
 * rendered the banner *instead of* `DashboardControls`, which took the variable bar down with the
 * time picker and left the user approving a structure they could not see.
 *
 * `DashboardControls` itself is still not rendered, and that is deliberate rather than incidental:
 * it also hosts `DashboardControlActions` (save, settings, share), which speak about a dashboard
 * that does not exist yet. Composing the two pieces the plan needs is what keeps those out.
 *
 * The time picker stays gone. Placeholder panels carry seeded data with no query runner, so a time
 * range would control nothing while implying the numbers respond to it — the same misread the
 * `Sample data` badge exists to prevent.
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
      <PlanningBanner planning={planning} />
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
      gap: theme.spacing(1),
      padding: theme.spacing(1, 2),
      // The hairline separates the plan's bar from the tinted canvas below it. The host
      // (DashboardControlsChrome) is already sticky, so this edge is what the panels pass under.
      borderBottom: `1px solid ${theme.colors.primary.borderTransparent}`,
    }),
    variables: css({
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'flex-end',
      gap: theme.spacing(1),
      '&:empty': {
        display: 'none',
      },
    }),
  };
}
