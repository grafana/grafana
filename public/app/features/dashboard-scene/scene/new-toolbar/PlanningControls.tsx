import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type DashboardScene } from '../DashboardScene';
import { VariableControls } from '../VariableControls';
import { getPlanningGround } from '../planningGround';
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
     * On the plan's ground rather than the bar's background, because the variables belong to the
     * dashboard being planned — they are part of what the user is approving, not part of the
     * approve/discard chrome above them. Grouping them with the banner read as the opposite.
     *
     * The whole ground is shared with the canvas — colour and dot grid — so the strip reads as the
     * top of the plan surface rather than a plain band above it, and so the two cannot drift.
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
