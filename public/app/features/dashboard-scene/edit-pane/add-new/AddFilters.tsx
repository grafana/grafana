import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { type SceneObject, SceneVariableSet } from '@grafana/scenes';

import { type DashboardScene } from '../../scene/DashboardScene';
import { getNextAvailableId, getVariableNamePrefix, getVariableScene } from '../../settings/variables/utils';
import { DashboardInteractions } from '../../utils/interactions';
import { dashboardEditActions } from '../shared';

import { AddButton } from './AddButton';

export function openAddFilterForm(dashboard: DashboardScene, sectionOwner: SceneObject) {
  const existing = sectionOwner.state.$variables;
  const variablesSet = existing instanceof SceneVariableSet ? existing : new SceneVariableSet({ variables: [] });

  if (!existing) {
    sectionOwner.setState({ $variables: variablesSet });
  }

  const type = 'adhoc';
  const name = getVariableNamePrefix(type);
  const newVar = getVariableScene(type, {
    name: getNextAvailableId(name, variablesSet.state.variables ?? []),
  });

  dashboardEditActions.addVariable({ source: variablesSet, addedObject: newVar });
  dashboard.state.editPane.selectObject(newVar, { force: true, multi: false });
}

export function AddFilters({ dashboardScene }: { dashboardScene: DashboardScene }) {
  const onAddFiltersClick = useCallback(() => {
    openAddFilterForm(dashboardScene, dashboardScene);
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
