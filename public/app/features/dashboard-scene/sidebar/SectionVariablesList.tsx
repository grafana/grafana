import { useCallback } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { type SceneObject, SceneVariableSet, sceneUtils } from '@grafana/scenes';
import { Stack } from '@grafana/ui';

import { openAddSectionVariablePane } from '../settings/variables/VariableTypeSelectionPane';
import { getTopPlacementLabel } from '../utils/getTopPlacementLabel';
import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor } from '../utils/utils';
import { filterSectionRepeatLocalVariables } from '../variables/utils';

import { DashboardVariablesList } from './dashboard/DashboardVariablesList';
import { SidebarAddButton } from './dashboard/SidebarAddButton';

export interface SectionVariablesCategoryTitleProps {
  /** Scene object that owns section-local variables */
  sectionOwner: SceneObject;
  isExpanded: boolean;
}

export function SectionVariablesCategoryTitle(_: SectionVariablesCategoryTitleProps) {
  return (
    <Stack direction="row" alignItems="center" gap={1} flex={1}>
      <span style={{ flexGrow: 1 }}>{t('dashboard.sidebar.section-variables.title', 'Variables')}</span>
    </Stack>
  );
}

/** Number of section variables shown in the list, used for the category items count. */
export function getSectionVariablesCount(sectionOwner: SceneObject): number {
  const variableSet = sectionOwner.state.$variables;

  if (!(variableSet instanceof SceneVariableSet)) {
    return 0;
  }

  const variables = filterSectionRepeatLocalVariables(variableSet.state.variables, variableSet);

  return config.featureToggles.dashboardUnifiedDrilldownControls
    ? variables.filter((v) => !sceneUtils.isAdHocVariable(v)).length
    : variables.length;
}

export interface SectionVariablesListProps {
  /** Scene object that owns section-local variables */
  sectionOwner: SceneObject;
}

export function SectionVariablesList({ sectionOwner }: SectionVariablesListProps) {
  const variableSet = sectionOwner.state.$variables;

  if (!(variableSet instanceof SceneVariableSet)) {
    return null;
  }

  return <SectionVariablesListInner sectionOwner={sectionOwner} variableSet={variableSet} />;
}

interface SectionVariablesListInnerProps {
  sectionOwner: SceneObject;
  variableSet: SceneVariableSet;
}

function SectionVariablesListInner({ sectionOwner, variableSet }: SectionVariablesListInnerProps) {
  const { variables: rawVariables } = variableSet.useState();
  const variables = filterSectionRepeatLocalVariables(rawVariables, variableSet);
  const topPlacementLabel = getTopPlacementLabel(sectionOwner);
  const visibleCount = config.featureToggles.dashboardUnifiedDrilldownControls
    ? variables.filter((v) => !sceneUtils.isAdHocVariable(v)).length
    : variables.length;

  if (visibleCount === 0) {
    return null;
  }

  return (
    <DashboardVariablesList
      sourceVariableSet={variableSet}
      renderVariables={variables}
      topPlacementLabel={topPlacementLabel}
      hideControlsMenuList
    />
  );
}

interface AddSectionVariableButtonProps {
  sectionOwner: SceneObject;
}

export function AddSectionVariableButton({ sectionOwner }: AddSectionVariableButtonProps) {
  const dashboard = getDashboardSceneFor(sectionOwner);

  const onAdd = useCallback(() => {
    openAddSectionVariablePane(dashboard, sectionOwner);
    DashboardInteractions.addVariableButtonClicked({ source: 'edit_pane' });
  }, [dashboard, sectionOwner]);

  return (
    <SidebarAddButton
      onAdd={onAdd}
      tooltip={t('dashboard.sidebar.variables.add-variable', 'Add variable')}
      dataTestId={selectors.components.PanelEditor.ElementEditPane.addVariableButton}
    />
  );
}
