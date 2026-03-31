import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { sceneGraph, SceneVariableSet } from '@grafana/scenes';

import { type DashboardScene } from '../../scene/DashboardScene';
import { getNextAvailableId, getVariableScene } from '../../settings/variables/utils';
import { DashboardInteractions } from '../../utils/interactions';
import { dashboardEditActions } from '../shared';

import { AddButton } from './AddButton';

function openAddFilterPane(dashboard: DashboardScene) {
  const variablesSet = sceneGraph.getVariables(dashboard);

  if (!(variablesSet instanceof SceneVariableSet)) {
    return;
  }

  const name = 'filter';
  const type = 'adhoc';
  const newVar = getVariableScene(type, { name: getNextAvailableId(name, variablesSet.state.variables ?? []) });
  dashboardEditActions.addVariable({ source: variablesSet, addedObject: newVar });
  dashboard.state.editPane.selectObject(newVar, newVar.state.key!, { force: true, multi: false });
  DashboardInteractions.newVariableTypeSelected({ type });
}

export function AddFilters({ dashboardScene }: { dashboardScene: DashboardScene }) {
  const onAddFiltersClick = useCallback(() => {
    openAddFilterPane(dashboardScene);
    DashboardInteractions.addVariableButtonClicked({ source: 'edit_pane' });
  }, [dashboardScene]);

  return (
    <AddButton
      icon="filter"
      label={t('dashboard-scene.add-filters.label', 'Filter and Group by')}
      onClick={onAddFiltersClick}
    />
  );
}
