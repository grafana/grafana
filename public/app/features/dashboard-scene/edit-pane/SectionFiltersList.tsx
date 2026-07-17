import { Trans, t } from '@grafana/i18n';
import { type SceneObject, SceneVariableSet, sceneUtils } from '@grafana/scenes';
import { Box, Button, Stack } from '@grafana/ui';

import { getTopPlacementLabel } from '../utils/getTopPlacementLabel';
import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor } from '../utils/utils';
import { filterSectionRepeatLocalVariables } from '../variables/utils';

import { openAddFilterForm } from './add-new/AddFilters';
import { DashboardVariablesList } from './dashboard/DashboardVariablesList';

export function SectionFiltersCategoryTitle() {
  return (
    <Stack direction="row" alignItems="center" gap={1} flex={1}>
      <span style={{ flexGrow: 1 }}>{t('dashboard.edit-pane.section-filters.title', 'Filters')}</span>
    </Stack>
  );
}

export interface SectionFiltersListProps {
  sectionOwner: SceneObject;
}

export function SectionFiltersList({ sectionOwner }: SectionFiltersListProps) {
  const variableSet = sectionOwner.state.$variables;

  if (!(variableSet instanceof SceneVariableSet)) {
    return (
      <Box display="flex" paddingBottom={2}>
        <AddFilterButton sectionOwner={sectionOwner} />
      </Box>
    );
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

  return (
    <>
      <DashboardVariablesList
        sourceVariableSet={variableSet}
        renderVariables={filters}
        topPlacementLabel={topPlacementLabel}
        includeAdHoc
      />
      <Box display="flex" paddingTop={filters.length > 0 ? 1 : 0} paddingBottom={2}>
        <AddFilterButton sectionOwner={sectionOwner} />
      </Box>
    </>
  );
}

function AddFilterButton({ sectionOwner }: { sectionOwner: SceneObject }) {
  const dashboard = getDashboardSceneFor(sectionOwner);

  return (
    <Button
      fullWidth
      icon="plus"
      size="sm"
      variant="secondary"
      onClick={() => {
        openAddFilterForm(dashboard, sectionOwner);
        DashboardInteractions.addSectionFilterButtonClicked({ source: 'edit_pane' });
      }}
    >
      <Trans i18nKey="dashboard-scene.section-filters-list.add-filter">Add filter</Trans>
    </Button>
  );
}
