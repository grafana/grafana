import { DragDropContext } from '@hello-pangea/dnd';
import { useCallback, useMemo } from 'react';

import { VariableHide } from '@grafana/data/types';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { type SceneVariableSet, type SceneVariable, sceneUtils } from '@grafana/scenes';
import { Box, Button } from '@grafana/ui';

import { type DashboardScene } from '../../scene/DashboardScene';
import { openAddVariablePane } from '../../settings/variables/VariableTypeSelectionPane';
import { isEditableVariableType } from '../../settings/variables/utils';
import { DashboardInteractions } from '../../utils/interactions';
import { getDashboardSceneFor } from '../../utils/utils';

import { DraggableList } from './DraggableList';
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

export function DashboardVariablesList({ variableSet }: { variableSet: SceneVariableSet }) {
  const { variables } = variableSet.useState();
  const editable = useMemo(() => {
    const { editable } = partitionVariablesByEditability(variables);
    if (!config.featureToggles.dashboardUnifiedDrilldownControls) {
      return editable;
    }
    return editable.filter((v) => !sceneUtils.isAdHocVariable(v));
  }, [variables]);
  const { visible, controlsMenu, hidden } = useMemo(() => partitionVariablesByDisplay(editable), [editable]);

  const onClickVariable = useCallback((variable: SceneVariable) => {
    const { editPane } = getDashboardSceneFor(variable).state;
    editPane.selectObject(variable);
  }, []);

  const onDragEnd = useMemo(
    () =>
      createDragEndHandler(
        variableSet,
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
    [variableSet, visible, controlsMenu, hidden]
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <DraggableList
        items={visible}
        droppableId={ID_VISIBLE_LIST}
        title={t('dashboard-scene.variables-list.title-above-dashboard', 'Above dashboard ({{count}})', {
          count: visible.length,
        })}
        onClickItem={onClickVariable}
        renderItemLabel={renderItemLabel}
      />
      <DraggableList
        items={controlsMenu}
        droppableId={ID_CONTROLS_MENU_LIST}
        title={t('dashboard-scene.variables-list.title-controls-menu', 'Controls menu ({{count}})', {
          count: controlsMenu.length,
        })}
        onClickItem={onClickVariable}
        renderItemLabel={renderItemLabel}
      />
      <DraggableList
        items={hidden}
        droppableId={ID_HIDDEN_LIST}
        title={t('dashboard-scene.variables-list.title-hidden', 'Hidden ({{count}})', { count: hidden.length })}
        onClickItem={onClickVariable}
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
    <Box display="flex" paddingTop={1} paddingBottom={1}>
      <Button
        fullWidth
        icon="plus"
        size="sm"
        variant="secondary"
        onClick={onAddVariable}
        data-testid={selectors.components.PanelEditor.ElementEditPane.addVariableButton}
      >
        <Trans i18nKey="dashboard-scene.variables-list.add-variable">Add variable</Trans>
      </Button>
    </Box>
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
