import { DragDropContext } from '@hello-pangea/dnd';
import { useCallback, useMemo } from 'react';

import { VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { type SceneVariableSet, type SceneVariable, sceneUtils } from '@grafana/scenes';

import { duplicateVariable } from '../../actions/variable/duplicateVariable';
import { type DashboardScene } from '../../scene/DashboardScene';
import { openAddVariablePane } from '../../settings/variables/VariableTypeSelectionPane';
import {
  getDefaultTopPlacementLabel,
  isEditableVariableType,
  isVariableEditable,
} from '../../settings/variables/utils';
import { DashboardInteractions } from '../../utils/interactions';

import { DraggableList } from './DraggableList';
import { SidebarAddButton } from './SidebarAddButton';
import { partitionSceneObjects, selectSidebarObject, toDraggableListItemActions } from './helpers';
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
}

export function DashboardVariablesList({
  sourceVariableSet,
  renderVariables,
  topPlacementLabel,
  hideControlsMenuList = false,
  includeAdHoc = false,
}: DashboardVariablesListProps) {
  const { variables: allVariables } = sourceVariableSet.useState();
  const listVariables = renderVariables ?? allVariables;
  const resolvedTopPlacementLabel = topPlacementLabel ? topPlacementLabel : getDefaultTopPlacementLabel();
  const editable = useMemo(() => {
    const { editable } = partitionVariablesByEditability(listVariables);
    if (!config.featureToggles.dashboardUnifiedDrilldownControls || includeAdHoc) {
      return editable;
    }
    return editable.filter((v) => !sceneUtils.isAdHocVariable(v));
  }, [includeAdHoc, listVariables]);
  const { visible, controlsMenu, hidden } = useMemo(() => partitionVariablesByDisplay(editable), [editable]);

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
        visible,
        controlsMenu,
        hidden,
        t('dashboard.sidebar.variables.reorder-description', 'Reorder variables list'),
        DROPPABLE_TO_HIDE
      ),
    [sourceVariableSet, visible, controlsMenu, hidden]
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <DraggableList
        items={visible}
        droppableId={ID_VISIBLE_LIST}
        title={resolvedTopPlacementLabel ?? t('dashboard.sidebar.variables.title-above-dashboard', 'Above dashboard')}
        renderItemLabel={renderItemLabel}
        {...variableActions}
      />
      {!hideControlsMenuList && (
        <DraggableList
          items={controlsMenu}
          droppableId={ID_CONTROLS_MENU_LIST}
          title={t('dashboard.sidebar.variables.title-controls-menu', 'Controls menu')}
          renderItemLabel={renderItemLabel}
          {...variableActions}
        />
      )}
      <DraggableList
        items={hidden}
        droppableId={ID_HIDDEN_LIST}
        title={t('dashboard.sidebar.variables.title-hidden', 'Hidden')}
        renderItemLabel={renderItemLabel}
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

export function partitionVariablesByDisplay(variables: SceneVariable[]) {
  const {
    visible = [],
    controlsMenu = [],
    hidden = [],
  } = partitionSceneObjects(variables, (v) => {
    if (!isEditableVariableType(v.state.type)) {
      return null;
    }

    switch (v.state.hide) {
      case VariableHide.hideVariable:
        return 'hidden';
      case VariableHide.inControlsMenu:
        return 'controlsMenu';
      default:
        return 'visible';
    }
  });
  return { visible, controlsMenu, hidden };
}
