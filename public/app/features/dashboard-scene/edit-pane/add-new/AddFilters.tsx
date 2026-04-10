import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { sceneGraph, SceneVariableSet } from '@grafana/scenes';

import { type DashboardScene } from '../../scene/DashboardScene';
import {
  getNextAvailableId,
  getVariableNamePrefix,
  getVariableScene,
  ADHOC_VARIABLE_TYPE,
} from '../../settings/variables/utils';
import { DashboardInteractions } from '../../utils/interactions';
import { dashboardEditActions } from '../shared';

import { AddButton } from './AddButton';

export function openAddFilterPane(dashboard: DashboardScene) {
  const variablesSet = sceneGraph.getVariables(dashboard);

  if (!(variablesSet instanceof SceneVariableSet)) {
    return;
  }

  const name = getVariableNamePrefix(ADHOC_VARIABLE_TYPE);
  const newVar = getVariableScene(ADHOC_VARIABLE_TYPE, {
    name: getNextAvailableId(name, variablesSet.state.variables ?? []),
  });
  dashboardEditActions.addVariable({ source: variablesSet, addedObject: newVar });
  dashboard.state.editPane.selectObject(newVar, { force: true, multi: false });
  DashboardInteractions.variableTypeSelected({ type: ADHOC_VARIABLE_TYPE });
}

export function AddFilters({ dashboardScene }: { dashboardScene: DashboardScene }) {
  const onAddFiltersClick = useCallback(() => {
    openAddFilterPane(dashboardScene);
    DashboardInteractions.addFilterButtonClicked({ source: 'edit_pane' });
  }, [dashboardScene]);

  return (
    <AddButton
      icon="filter"
      label={t('dashboard-scene.add-filters.label', 'Filter and Group by')}
      onClick={onAddFiltersClick}
    />
  );
}
