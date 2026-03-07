import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { AdHocFiltersVariable, GroupByVariable } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { VariableValueSelectWrapper } from './VariableControls';

interface DrilldownControlsProps {
  adHocVar: AdHocFiltersVariable;
  groupByVar: GroupByVariable;
  isEditing?: boolean;
}

/**
 * DrilldownControls renders the AdHoc and GroupBy variables in a single row above the other variables.
 */
export function DrilldownControls({ adHocVar, groupByVar, isEditing }: DrilldownControlsProps) {
  const styles = useStyles2(getStyles);
  const isEditingNewLayouts = isEditing && config.featureToggles.dashboardNewLayouts;

  return (
    <div className={styles.drilldownRow}>
      <div className={styles.adHocContainer}>
        <VariableValueSelectWrapper variable={adHocVar} isEditingNewLayouts={isEditingNewLayouts} />
      </div>
      <div className={styles.groupByContainer}>
        <VariableValueSelectWrapper variable={groupByVar} isEditingNewLayouts={isEditingNewLayouts} />
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  drilldownRow: css({
    display: 'flex',
    flexWrap: 'nowrap',
    [theme.breakpoints.down('xl')]: {
      flexWrap: 'wrap',
    },
    gap: theme.spacing(1),
    width: '100%',
  }),
  adHocContainer: css({
    flex: '7 1 0%', // 70% of available space
    minWidth: 0,
    [theme.breakpoints.down('xl')]: {
      // Force full width, causing groupBy to wrap
      flex: '1 1 100%',
    },
    display: 'flex',
    // Make the wrapper and its children take full width
    '& > div': {
      alignItems: 'flex-start',
      width: '100%',
      flex: 1,
    },
  }),
  groupByContainer: css({
    flex: '3 1 0%', // 30% of available space
    minWidth: 0,
    display: 'flex',
    // Make the wrapper and its children take full width
    '& > div': {
      alignItems: 'flex-start',
      width: '100%',
      flex: 1,
    },
    [theme.breakpoints.down('sm')]: {
      minWidth: '200px',
    },
  }),
  clearAllButton: css({
    alignSelf: 'flex-start',
    fontSize: theme.typography.bodySmall.fontSize,
    padding: theme.spacing(0.5, 0.5),
    marginBottom: theme.spacing(1),
  }),
});
