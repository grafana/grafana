import { css } from '@emotion/css';
import { useCallback } from 'react';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { openAddVariablePane } from '../settings/variables/VariableTypeSelectionPane';
import { DashboardInteractions } from '../utils/interactions';

import { type DashboardScene } from './DashboardScene';

export function AddVariableButton({ dashboard }: { dashboard: DashboardScene }) {
  const styles = useStyles2(getStyles);
  const { editview, editPanel, isEditing, viewPanel } = dashboard.useState();

  const handleClick = useCallback(() => {
    openAddVariablePane(dashboard);
    DashboardInteractions.addVariableButtonClicked({ source: 'variable_controls' });
  }, [dashboard]);

  // Hide the button if:
  // - the dashboard is not in edit mode
  // - the dashboard is in an edit view mode
  // - the dashboard is in a view panel mode
  // - the dashboard is in an edit panel mode
  if (!isEditing || !!editview || !!viewPanel || !!editPanel) {
    return null;
  }

  return (
    <div className={styles.addButton}>
      <div className="dashboard-canvas-add-button">
        <Button
          icon="plus"
          variant="secondary"
          fill="outline"
          size="md"
          onClick={handleClick}
          tooltip={t('dashboard-scene.variable-controls.add-variable', 'Add variable')}
          aria-label={t('dashboard-scene.variable-controls.add-variable', 'Add variable')}
        />
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  addButton: css({
    display: 'inline-flex',
    alignItems: 'center',
    verticalAlign: 'middle',
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(1),
  }),
});
