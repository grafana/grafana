import { useCallback, useMemo } from 'react';

import { VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { type SceneVariableSet, type SceneVariable } from '@grafana/scenes';
import { useDragAndDrop } from '@grafana/ui/internal';

import { duplicateVariable } from '../../actions/variable/duplicateVariable';
import { type DashboardScene } from '../../scene/DashboardScene';
import { openAddVariablePane } from '../../settings/variables/VariableTypeSelectionPane';
import { getDefaultTopPlacementLabel, isVariableEditable } from '../../settings/variables/utils';
import { DashboardInteractions } from '../../utils/interactions';

import { DraggableList } from './DraggableList';
import { ReadOnlyVariableRows } from './ReadOnlyVariableGroup';
import { SidebarAddButton } from './SidebarAddButton';
import { partitionSceneObjects, selectSidebarObject, toDraggableListItemActions } from './helpers';
import { groupSidebarVariablesByDisplay } from './partitionSidebarVariables';
import { confirmDeleteVariable, createDragEndHandler } from './variableListActions';

const ID_VISIBLE_LIST = 'variables-list-visible';
const ID_CONTROLS_MENU_LIST = 'variables-list-controls-menu';
const ID_HIDDEN_LIST = 'variables-list-hidden';

const DROPPABLE_TO_HIDE: Record<string, VariableHide> = {
  [ID_VISIBLE_LIST]: VariableHide.dontHide,
  [ID_CONTROLS_MENU_LIST]: VariableHide.inControlsMenu,
  [ID_HIDDEN_LIST]: VariableHide.hideVariable,
};

interface DashboardVariablesListProps {
  sourceVariableSet: SceneVariableSet;
  renderVariables?: SceneVariable[];
  topPlacementLabel?: string;
  includeAdHoc?: boolean;
  hideControlsMenuList?: boolean;
  /** Dashboard options show opted-in global and folder variables. Section lists do not. */
  showPredefinedGroups?: boolean;
}

export function DashboardVariablesList({
  sourceVariableSet,
  renderVariables,
  topPlacementLabel,
  hideControlsMenuList = false,
  includeAdHoc = false,
  showPredefinedGroups = false,
}: DashboardVariablesListProps) {
  const { DragDropContext } = useDragAndDrop();
  const { variables: allVariables } = sourceVariableSet.useState();
  const listVariables = renderVariables ?? allVariables;
  const includePredefined = showPredefinedGroups;
  const excludeFilters = Boolean(config.featureToggles.dashboardUnifiedDrilldownControls) && !includeAdHoc;
  const resolvedTopPlacementLabel = topPlacementLabel ? topPlacementLabel : getDefaultTopPlacementLabel();
  const { visible, controlsMenu, hidden } = useMemo(
    () => groupSidebarVariablesByDisplay(listVariables, { includePredefined, excludeFilters }),
    [excludeFilters, includePredefined, listVariables]
  );

  const variableActions = toDraggableListItemActions<SceneVariable>(
    selectSidebarObject,
    duplicateVariable,
    confirmDeleteVariable
  );

  const onDragEnd = useMemo(
    () =>
      createDragEndHandler(
        sourceVariableSet,
        { visible: ID_VISIBLE_LIST, controlsMenu: ID_CONTROLS_MENU_LIST, hidden: ID_HIDDEN_LIST },
        visible.editable,
        controlsMenu.editable,
        hidden.editable,
        t('dashboard.sidebar.variables.reorder-description', 'Reorder variables list'),
        DROPPABLE_TO_HIDE
      ),
    [sourceVariableSet, visible.editable, controlsMenu.editable, hidden.editable]
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <DraggableList
        items={visible.editable}
        droppableId={ID_VISIBLE_LIST}
        title={resolvedTopPlacementLabel ?? t('dashboard.sidebar.variables.title-above-dashboard', 'Above dashboard')}
        renderItemLabel={renderItemLabel}
        leading={<ReadOnlyVariableRows variables={visible.readOnly} itemTestId="variable-name" />}
        itemsCount={visible.editable.length + visible.readOnly.length}
        {...variableActions}
      />
      {!hideControlsMenuList && (
        <DraggableList
          items={controlsMenu.editable}
          droppableId={ID_CONTROLS_MENU_LIST}
          title={t('dashboard.sidebar.variables.title-controls-menu', 'Controls menu')}
          renderItemLabel={renderItemLabel}
          leading={<ReadOnlyVariableRows variables={controlsMenu.readOnly} itemTestId="variable-name" />}
          itemsCount={controlsMenu.editable.length + controlsMenu.readOnly.length}
          {...variableActions}
        />
      )}
      <DraggableList
        items={hidden.editable}
        droppableId={ID_HIDDEN_LIST}
        title={t('dashboard.sidebar.variables.title-hidden', 'Hidden')}
        renderItemLabel={renderItemLabel}
        leading={<ReadOnlyVariableRows variables={hidden.readOnly} itemTestId="variable-name" />}
        itemsCount={hidden.editable.length + hidden.readOnly.length}
        {...variableActions}
      />
    </DragDropContext>
  );
}

const renderItemLabel = (v: SceneVariable) => <span data-testid="variable-name">{v.state.name}</span>;

export function AddVariableButton({ dashboard }: { dashboard: DashboardScene }) {
  const onAddVariable = useCallback(() => {
    openAddVariablePane(dashboard);
    DashboardInteractions.addVariableButtonClicked({ source: 'edit_pane' });
  }, [dashboard]);

  return (
    <SidebarAddButton
      dataTestId={selectors.components.PanelEditor.ElementEditPane.addVariableButton}
      onAdd={onAddVariable}
      tooltip={t('dashboard.sidebar.variables.add-variable', 'Add variable')}
    />
  );
}

export function partitionVariablesByEditability(variables: SceneVariable[]) {
  const { editable = [], nonEditable = [] } = partitionSceneObjects(variables, (v) =>
    isVariableEditable(v) ? 'editable' : 'nonEditable'
  );
  return { editable, nonEditable };
}
