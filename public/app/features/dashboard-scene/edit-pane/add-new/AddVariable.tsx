import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
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
  // OpenFeature is not initialized for anonymous users, so fall back to
  // the static feature toggle to ensure section variables work without auth.
  const sectionVariablesEnabled = useBooleanFlagValue(
    'dashboardSectionVariables',
    Boolean(config.featureToggles.dashboardSectionVariables)
  );

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
