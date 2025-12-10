import { css } from '@emotion/css';

import { GrafanaTheme2, VariableHide } from '@grafana/data';
import { config } from '@grafana/runtime';
import { SceneVariable, sceneUtils } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { VariableValueSelectWrapper } from './VariableControls';

interface DrilldownControlsProps {
  adHocVar: SceneVariable;
  groupByVar: SceneVariable;
}

/**
 * Checks if the first two variables are AdHoc and GroupBy (in that order)
 * and the feature toggle is enabled.
 */
export function shouldUseDrilldownLayout(variables: SceneVariable[]): boolean {
  if (!config.featureToggles.newDashboardWithFiltersAndGroupBy) {
    return false;
  }

  const visibleVariables = variables.filter((v) => v.state.hide !== VariableHide.hideVariable);

  if (visibleVariables.length < 2) {
    return false;
  }

  const firstVar = visibleVariables[0];
  const secondVar = visibleVariables[1];

  return sceneUtils.isAdHocVariable(firstVar) && sceneUtils.isGroupByVariable(secondVar);
}

/**
 * DrilldownControls renders the first two variables (AdHoc + GroupBy) in a single row
 * with 70%/30% width distribution.
 */
export function DrilldownControls({ adHocVar, groupByVar }: DrilldownControlsProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.drilldownRow}>
      <div className={styles.adHocContainer}>
        <VariableValueSelectWrapper variable={adHocVar} />
      </div>
      <div className={styles.groupByContainer}>
        <VariableValueSelectWrapper variable={groupByVar} />
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  drilldownRow: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0, 1),
  }),
  adHocContainer: css({
    minWidth: '380px',
    maxWidth: '60%',
  }),
  groupByContainer: css({
    minWidth: '260px',
    maxWidth: '40%',
  }),
});
