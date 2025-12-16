import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { AdHocFiltersVariable, GroupByVariable } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { VariableValueSelectWrapper } from './VariableControls';

interface DrilldownControlsProps {
  adHocVar: AdHocFiltersVariable;
  groupByVar: GroupByVariable;
}

/**
 * DrilldownControls renders the AdHoc and GroupBy variables in a single row above the other variables.
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
    width: '100%',
  }),
  adHocContainer: css({
    maxWidth: '700px',
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
