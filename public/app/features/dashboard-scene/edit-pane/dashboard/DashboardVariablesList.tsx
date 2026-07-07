import { DragDropContext } from '@hello-pangea/dnd';
import { useCallback, useMemo } from 'react';

import { VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { type SceneVariableSet, type SceneVariable, sceneUtils } from '@grafana/scenes';

import { type DashboardScene } from '../../scene/DashboardScene';
import { VariableEditableElement } from '../../settings/variables/VariableEditableElement';
import { openAddVariablePane } from '../../settings/variables/VariableTypeSelectionPane';
import { getDefaultTopPlacementLabel, isEditableVariableType } from '../../settings/variables/utils';
import { DashboardInteractions } from '../../utils/interactions';
import { getDashboardSceneFor } from '../../utils/utils';

import { DraggableList } from './DraggableList';
import { SidebarAddButton } from './SidebarAddButton';
import { partitionSceneObjects } from './helpers';
import { createDragEndHandler } from './variablesDragEndHandler';

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

  const onClickVariable = useCallback((variable: SceneVariable) => {
    const { editPane } = getDashboardSceneFor(variable).state;
    editPane.selectObject(variable);
  }, []);

  const onDuplicateVariable = useCallback((variable: SceneVariable) => {
    new VariableEditableElement(variable).onDuplicate();
  }, []);

  const onDeleteVariable = useCallback((variable: SceneVariable) => {
    new VariableEditableElement(variable).onConfirmDelete();
  }, []);

  const onDragEnd = useMemo(
    () =>
      createDragEndHandler(
        sourceVariableSet,
        { visible: ID_VISIBLE_LIST, controlsMenu: ID_CONTROLS_MENU_LIST, hidden: ID_HIDDEN_LIST },
        visible,
        controlsMenu,
        hidden,
        t(
          'dashboard-scene.variables-list.create-drag-end-handler.description.reorder-variables-list',
          'Reorder variables list'
        ),
        DROPPABLE_TO_HIDE
      ),
    [sourceVariableSet, visible, controlsMenu, hidden]
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <DraggableList
        items={visible}
        droppableId={ID_VISIBLE_LIST}
        title={resolvedTopPlacementLabel}
        onEditItem={onClickVariable}
        onDuplicateItem={onDuplicateVariable}
        onDeleteItem={onDeleteVariable}
        renderItemLabel={renderItemLabel}
      />
      {!hideControlsMenuList && (
        <DraggableList
          items={controlsMenu}
          droppableId={ID_CONTROLS_MENU_LIST}
          title={t('dashboard-scene.variables-list.title-controls-menu', 'Controls menu')}
          onEditItem={onClickVariable}
          onDuplicateItem={onDuplicateVariable}
          onDeleteItem={onDeleteVariable}
          renderItemLabel={renderItemLabel}
        />
      )}
      <DraggableList
        items={hidden}
        droppableId={ID_HIDDEN_LIST}
        title={t('dashboard-scene.variables-list.title-hidden', 'Hidden')}
        onEditItem={onClickVariable}
        onDuplicateItem={onDuplicateVariable}
        onDeleteItem={onDeleteVariable}
        renderItemLabel={renderItemLabel}
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
      data-testid={selectors.components.PanelEditor.ElementEditPane.addVariableButton}
      onAdd={onAddVariable}
      tooltip={t('dashboard-scene.variables-list.add-variable', 'Add variable')}
    />
  );
}

export function partitionVariablesByEditability(variables: SceneVariable[]) {
  const { editable = [], nonEditable = [] } = partitionSceneObjects(variables, (v) =>
    isEditableVariableType(v.state.type) ? 'editable' : 'nonEditable'
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
