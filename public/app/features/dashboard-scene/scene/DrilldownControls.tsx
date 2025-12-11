import { css } from '@emotion/css';

import { GrafanaTheme2, VariableHide } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { SceneVariable, sceneUtils } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';

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
 */
export function DrilldownControls({ adHocVar, groupByVar }: DrilldownControlsProps) {
  const styles = useStyles2(getStyles);

  const clearAll = () => {
    if (sceneUtils.isAdHocVariable(adHocVar)) {
      // Restore origin filters to their defaults
      if (adHocVar.state.originFilters && adHocVar.state.originFilters.length > 0) {
        adHocVar.state.originFilters.forEach((filter) => {
          adHocVar.restoreOriginalFilter(filter);
        });
      }

      // Clear user-added filters (
      adHocVar.updateFilters([]);
    }

    if (sceneUtils.isGroupByVariable(groupByVar)) {
      if (groupByVar.state.defaultValue) {
        groupByVar.restoreDefaultValues();
      } else {
        // No default value, clear to empty
        groupByVar.changeValueTo([], []);
      }
    }
  };

  return (
    <div className={styles.drilldownRow}>
      <div className={styles.adHocContainer}>
        <VariableValueSelectWrapper variable={adHocVar} />
      </div>
      <div className={styles.groupByContainer}>
        <VariableValueSelectWrapper variable={groupByVar} />
      </div>

      <Button
        aria-label={t('grafana-ui.drilldown-controls.clear-all', 'Clear all')}
        onClick={clearAll}
        variant="secondary"
        size="md"
        fill="text"
        className={styles.clearAllButton}
      >
        <Trans i18nKey="grafana-ui.drilldown-controls.clear-all" defaults="Clear all" />
      </Button>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  drilldownRow: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0, 1),
    width: '100%',
  }),
  adHocContainer: css({
    maxWidth: '600px',
    // Override the inner container's alignItems to keep label at top
    '& > div': {
      alignItems: 'flex-start',
    },
  }),
  groupByContainer: css({
    maxWidth: '400px',
    // Override the inner container's alignItems to keep label at top
    '& > div': {
      alignItems: 'flex-start',
    },
  }),
  clearAllButton: css({
    alignSelf: 'flex-start',
    fontSize: theme.typography.bodySmall.fontSize,
    padding: theme.spacing(0.5, 0.5),
    marginBottom: theme.spacing(1),
  }),
});
