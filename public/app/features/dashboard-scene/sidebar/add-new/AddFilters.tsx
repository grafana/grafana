import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { type SceneObject, SceneVariableSet } from '@grafana/scenes';

import { addVariable } from '../../actions/variable/addVariable';
import { type DashboardSceneLike } from '../../scene/types/dashboard';
import { getNextAvailableId, getVariableNamePrefix, getVariableScene } from '../../settings/variables/utils';
import { DashboardInteractions } from '../../utils/interactions';

import { AddButton } from './AddButton';

export function openAddFilterForm(dashboard: DashboardSceneLike, sectionOwner: SceneObject) {
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

  addVariable({ source: variablesSet, addedObject: newVar });
  dashboard.state.sidebar.selectObject(newVar, { force: true, multi: false });
}

export function AddFilters({ dashboardScene }: { dashboardScene: DashboardSceneLike }) {
  const onAddFiltersClick = useCallback(() => {
    openAddFilterForm(dashboardScene, dashboardScene);
    DashboardInteractions.addFilterButtonClicked({ source: 'edit_pane' });
  }, [dashboardScene]);

  return (
    <AddButton
      icon="filter"
      label={t('dashboard.sidebar.add.filters.label', 'Filter and Group by')}
      onClick={onAddFiltersClick}
    />
  );
}
