import { t } from '@grafana/i18n';
import { type SceneObject, SceneVariableSet, sceneUtils } from '@grafana/scenes';
import { Stack } from '@grafana/ui';

import { getTopPlacementLabel } from '../utils/getTopPlacementLabel';
import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor } from '../utils/utils';
import { filterSectionRepeatLocalVariables } from '../variables/utils';

import { openAddFilterForm } from './add-new/AddFilters';
import { DashboardVariablesList } from './dashboard/DashboardVariablesList';
import { SidebarAddButton } from './dashboard/SidebarAddButton';

export function SectionFiltersCategoryTitle() {
  return (
    <Stack direction="row" alignItems="center" gap={1} flex={1}>
      <span style={{ flexGrow: 1 }}>{t('dashboard.sidebar.section-filters.title', 'Filters')}</span>
    </Stack>
  );
}

/** Number of section filters shown in the list, used for the category items count. */
export function getSectionFiltersCount(sectionOwner: SceneObject): number {
  const variableSet = sectionOwner.state.$variables;

  if (!(variableSet instanceof SceneVariableSet)) {
    return 0;
  }

  return filterSectionRepeatLocalVariables(variableSet.state.variables, variableSet).filter(sceneUtils.isAdHocVariable)
    .length;
}

export interface SectionFiltersListProps {
  sectionOwner: SceneObject;
}

export function SectionFiltersList({ sectionOwner }: SectionFiltersListProps) {
  const variableSet = sectionOwner.state.$variables;

  if (!(variableSet instanceof SceneVariableSet)) {
    return null;
  }

  return <SectionFiltersListInner sectionOwner={sectionOwner} variableSet={variableSet} />;
}

interface SectionFiltersListInnerProps {
  sectionOwner: SceneObject;
  variableSet: SceneVariableSet;
}

function SectionFiltersListInner({ sectionOwner, variableSet }: SectionFiltersListInnerProps) {
  const { variables: rawVariables } = variableSet.useState();
  const filters = filterSectionRepeatLocalVariables(rawVariables, variableSet).filter(sceneUtils.isAdHocVariable);
  const topPlacementLabel = getTopPlacementLabel(sectionOwner);

  if (filters.length === 0) {
    return null;
  }

  return (
    <DashboardVariablesList
      sourceVariableSet={variableSet}
      renderVariables={filters}
      topPlacementLabel={topPlacementLabel}
      includeAdHoc
      hideControlsMenuList
    />
  );
}

export function AddSectionFilterButton({ sectionOwner }: { sectionOwner: SceneObject }) {
  const dashboard = getDashboardSceneFor(sectionOwner);

  return (
    <SidebarAddButton
      tooltip={t('dashboard.sidebar.filters.add-filter', 'Add filter')}
      onAdd={() => {
        openAddFilterForm(dashboard, sectionOwner);
        DashboardInteractions.addSectionFilterButtonClicked({ source: 'edit_pane' });
      }}
    />
  );
}
