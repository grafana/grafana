import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { useCallback, useMemo } from 'react';

import { VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { SceneVariableSet, type SceneVariable } from '@grafana/scenes';
import { Box, Button } from '@grafana/ui';

import { openAddVariablePane } from '../../settings/variables/VariableAddEditableElement';
import { isEditableVariableType } from '../../settings/variables/utils';
import { DashboardInteractions } from '../../utils/interactions';
import { getDashboardSceneFor } from '../../utils/utils';
import { dashboardEditActions } from '../shared';

import { DraggableList } from './DraggableList';
import { partitionSceneObjects } from './helpers';

const ID_VISIBLE_LIST = 'variables-list-visible';
const ID_CONTROLS_MENU_LIST = 'variables-list-controls-menu';
const ID_HIDDEN_LIST = 'variables-list-hidden';

const DROPPABLE_TO_HIDE: Record<string, VariableHide> = {
  [ID_VISIBLE_LIST]: VariableHide.dontHide,
  [ID_CONTROLS_MENU_LIST]: VariableHide.inControlsMenu,
  [ID_HIDDEN_LIST]: VariableHide.hideVariable,
};

export function DashboardVariablesList({ set }: { set: SceneVariableSet }) {
  const { variables } = set.useState();
  const { editable, nonEditable } = useMemo(() => partitionVariablesByEditability(variables), [variables]);
  const { visible, controlsMenu, hidden } = useMemo(() => partitionVariablesByDisplay(editable), [editable]);

  const onClickVariable = useCallback((variable: SceneVariable) => {
    const { editPane } = getDashboardSceneFor(variable).state;
    editPane.selectObject(variable, variable.state.key!);
  }, []);

  const onAddVariable = useCallback(() => {
    openAddVariablePane(getDashboardSceneFor(set));
    DashboardInteractions.addVariableButtonClicked({ source: 'edit_pane' });
  }, [set]);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination } = result;
      if (!destination) {
        return;
      }

      const isSameList = source.droppableId === destination.droppableId;
      if (isSameList && source.index === destination.index) {
        return;
      }

      const currentVariables = set.state.variables;
      const lists: Record<string, SceneVariable[]> = {
        [ID_VISIBLE_LIST]: [...visible],
        [ID_CONTROLS_MENU_LIST]: [...controlsMenu],
        [ID_HIDDEN_LIST]: [...hidden],
      };

      const sourceList = lists[source.droppableId];
      const destList = isSameList ? sourceList : lists[destination.droppableId];

      const [moved] = sourceList.splice(source.index, 1);
      destList.splice(destination.index, 0, moved);

      const oldHide = moved.state.hide ?? VariableHide.dontHide;
      const newHide = getTargetHide(destination.droppableId, oldHide);

      dashboardEditActions.edit({
        source: set,
        description: t(
          'dashboard-scene.variables-list.create-drag-end-handler.description.reorder-variables-list',
          'Reorder variables list'
        ),
        perform: () => {
          if (newHide !== oldHide) {
            moved.setState({ hide: newHide });
          }
          set.setState({
            variables: [
              ...nonEditable,
              ...lists[ID_VISIBLE_LIST],
              ...lists[ID_CONTROLS_MENU_LIST],
              ...lists[ID_HIDDEN_LIST],
            ],
          });
        },
        undo: () => {
          if (newHide !== oldHide) {
            moved.setState({ hide: oldHide });
          }
          set.setState({ variables: currentVariables });
        },
      });
    },
    [set, nonEditable, visible, controlsMenu, hidden]
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <DraggableList
        items={visible}
        droppableId={ID_VISIBLE_LIST}
        title={t('dashboard-scene.variables-list.title-above-dashboard', 'Above dashboard ({{count}})', {
          count: visible.length,
        })}
        dataTestId={`${ID_VISIBLE_LIST}-variable-name`}
        onClickItem={onClickVariable}
        renderItemLabel={(v) => v.state.name}
      />
      <DraggableList
        items={controlsMenu}
        droppableId={ID_CONTROLS_MENU_LIST}
        title={t('dashboard-scene.variables-list.title-controls-menu', 'Controls menu ({{count}})', {
          count: controlsMenu.length,
        })}
        dataTestId={`${ID_CONTROLS_MENU_LIST}-variable-name`}
        onClickItem={onClickVariable}
        renderItemLabel={(v) => v.state.name}
      />
      <DraggableList
        items={hidden}
        droppableId={ID_HIDDEN_LIST}
        title={t('dashboard-scene.variables-list.title-hidden', 'Hidden ({{count}})', { count: hidden.length })}
        dataTestId={`${ID_HIDDEN_LIST}-variable-name`}
        onClickItem={onClickVariable}
        renderItemLabel={(v) => v.state.name}
      />
      <Box display="flex" paddingTop={1} paddingBottom={2}>
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
    </DragDropContext>
  );
}

function getTargetHide(droppableId: string, currentHide: VariableHide): VariableHide {
  if (droppableId === ID_VISIBLE_LIST) {
    return currentHide === VariableHide.dontHide || currentHide === VariableHide.hideLabel
      ? currentHide
      : VariableHide.dontHide;
  }
  return DROPPABLE_TO_HIDE[droppableId];
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
