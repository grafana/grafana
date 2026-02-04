import { css } from '@emotion/css';
import { PointerEventHandler, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';

import { openAddVariablePane } from '../settings/variables/VariableAddEditableElement';
import { DashboardInteractions } from '../utils/interactions';

import { DashboardScene } from './DashboardScene';

export function AddVariableButton({ dashboard }: { dashboard: DashboardScene }) {
  const styles = useStyles2(getStyles);
  const { editview, editPanel, isEditing, viewPanel } = dashboard.useState();

  const handlePointerDown: PointerEventHandler = useCallback(
    (evt) => {
      evt.stopPropagation();
      openAddVariablePane(dashboard);
      DashboardInteractions.addVariableButtonClicked({ source: 'variable_controls' });
    },
    [dashboard]
  );

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
        <Button icon="plus" variant="primary" fill="text" onPointerDown={handlePointerDown}>
          <Trans i18nKey="dashboard-scene.variable-controls.add-variable">Add variable</Trans>
        </Button>
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
