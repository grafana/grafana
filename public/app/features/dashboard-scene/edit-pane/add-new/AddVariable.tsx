import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { SceneObject } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { openAddSectionVariablePane, openAddVariablePane } from '../../settings/variables/VariableAddEditableElement';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { DashboardInteractions } from '../../utils/interactions';

import { AddButton } from './AddButton';

export function AddVariable({
  dashboardScene,
  selectedElement,
}: {
  dashboardScene: DashboardScene;
  selectedElement: SceneObject | undefined;
}) {
  const sectionVariablesEnabled = useBooleanFlagValue('dashboardSectionVariables', false);

  const onAddVariableClick = useCallback(() => {
    const sectionOwner = sectionVariablesEnabled ? dashboardSceneGraph.findSectionOwner(selectedElement) : undefined;
    if (sectionOwner) {
      openAddSectionVariablePane(dashboardScene, sectionOwner);
    } else {
      openAddVariablePane(dashboardScene);
    }
    DashboardInteractions.addVariableButtonClicked({ source: 'edit_pane' });
  }, [dashboardScene, selectedElement, sectionVariablesEnabled]);

  return (
    <AddButton
      icon="brackets-curly"
      label={t('dashboard-scene.add-variable.label-variable', 'Variable')}
      onClick={onAddVariableClick}
    />
  );
}
