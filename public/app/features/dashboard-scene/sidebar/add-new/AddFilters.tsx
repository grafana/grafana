import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { type SceneObject, SceneVariableSet } from '@grafana/scenes';

import { addVariable } from '../../actions/variable/addVariable';
import { type DashboardSceneLike } from '../../scene/types/dashboard';
import { getNextAvailableId, getVariableNamePrefix, getVariableScene } from '../../settings/variables/utils';
import { DashboardInteractions } from '../../utils/interactions';

import { AddButton } from './AddButton';

export async function openAddFilterForm(
  dashboard: DashboardSceneLike,
  sectionOwner: SceneObject,
  signal?: AbortSignal
): Promise<void> {
  if (!signal) {
    return dashboard.state.sidebar.runPaneRequest((signal) => openAddFilterForm(dashboard, sectionOwner, signal));
  }
  const existing = sectionOwner.state.$variables;
  const variablesSet = existing instanceof SceneVariableSet ? existing : new SceneVariableSet({ variables: [] });

  const type = 'adhoc';
  const name = getVariableNamePrefix(type);
  const newVar = await getVariableScene(type, {
    name: getNextAvailableId(name, variablesSet.state.variables ?? []),
  });

  if (signal.aborted) {
    return;
  }
  if (!existing) {
    sectionOwner.setState({ $variables: variablesSet });
  }
  addVariable({ source: variablesSet, addedObject: newVar });
  dashboard.state.sidebar.selectObject(newVar, { force: true, multi: false });
}

export function AddFilters({ dashboardScene }: { dashboardScene: DashboardSceneLike }) {
  const onAddFiltersClick = useCallback(() => {
    void openAddFilterForm(dashboardScene, dashboardScene);
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
