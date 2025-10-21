import { PointerEventHandler, useCallback } from 'react';

import { Trans } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { openAddVariablePane } from '../settings/variables/VariableAddEditableElement';
import { DashboardInteractions } from '../utils/interactions';

import { DashboardScene } from './DashboardScene';

export function AddVariableButton({ dashboard }: { dashboard: DashboardScene }) {
  const { isEditing } = dashboard.useState();

  const handlePointerDown: PointerEventHandler = useCallback(
    (evt) => {
      evt.stopPropagation();
      openAddVariablePane(dashboard);
      DashboardInteractions.addVariableButtonClicked({ source: 'variable_controls' });
    },
    [dashboard]
  );

  if (!isEditing) {
    return null;
  }

  return (
    <Button icon="plus" variant="primary" fill="text" onPointerDown={handlePointerDown}>
      <Trans i18nKey="dashboard-scene.variable-controls.add-variable">Add</Trans>
    </Button>
  );
}
