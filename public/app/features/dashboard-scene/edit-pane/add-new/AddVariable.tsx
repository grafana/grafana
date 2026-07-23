import { useCallback } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { type DashboardSceneLike } from '../../scene/types/dashboard';
import { openAddSectionVariablePane, openAddVariablePane } from '../../settings/variables/VariableTypeSelectionPane';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { DashboardInteractions } from '../../utils/interactions';

import { AddButton } from './AddButton';

export function AddVariable({
  dashboardScene,
  selectedElement,
}: {
  dashboardScene: DashboardSceneLike;
  selectedElement: SceneObject | undefined;
}) {
  const onAddVariableClick = useCallback(() => {
    const sectionOwner = dashboardSceneGraph.findSectionOwner(selectedElement);
    if (sectionOwner) {
      openAddSectionVariablePane(dashboardScene, sectionOwner);
    } else {
      openAddVariablePane(dashboardScene);
    }
    DashboardInteractions.addVariableButtonClicked({ source: 'edit_pane' });
  }, [dashboardScene, selectedElement]);

  return (
    <AddButton
      icon="brackets-curly"
      testId={selectors.components.Sidebar.addNewVariableButton}
      label={t('dashboard-scene.add-variable.label-variable', 'Variable')}
      onClick={onAddVariableClick}
    />
  );
}
