import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { useCallback, useMemo } from 'react';

import { VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { SceneVariableSet, type SceneVariable } from '@grafana/scenes';
import { Box, Button, Icon, Stack, Tooltip, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';

import { openAddVariablePane } from '../../settings/variables/VariableAddEditableElement';
import { isEditableVariableType } from '../../settings/variables/utils';
import { DashboardInteractions } from '../../utils/interactions';
import { getDashboardSceneFor } from '../../utils/utils';
import { dashboardEditActions } from '../shared';

import { partitionSceneObjects } from './helpers';
import { getDraggableListStyles } from './styles';

const ID_VISIBLE_LIST = 'variables-list-visible';
const ID_CONTROLS_MENU_LIST = 'variables-list-controls-menu';
const ID_HIDDEN_LIST = 'variables-list-hidden';

const DROPPABLE_TO_HIDE: Record<string, VariableHide> = {
  [ID_VISIBLE_LIST]: VariableHide.dontHide,
  [ID_CONTROLS_MENU_LIST]: VariableHide.inControlsMenu,
  [ID_HIDDEN_LIST]: VariableHide.hideVariable,
};

export function DashboardVariablesList({ set }: { set: SceneVariableSet }) {
  const styles = useStyles2(getDraggableListStyles);
  const { variables } = set.useState();
  const { editable, nonEditable } = useMemo(() => partitionVariablesByEditability(variables), [variables]);
  const { visible, controlsMenu, hidden } = useMemo(() => partitionVariablesByDisplay(editable), [editable]);

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

  const onClickVariable = useCallback((variable: SceneVariable) => {
    const { editPane } = getDashboardSceneFor(variable).state;
    editPane.selectObject(variable, variable.state.key!);
  }, []);

  const onAddVariable = useCallback(() => {
    openAddVariablePane(getDashboardSceneFor(set));
    DashboardInteractions.addVariableButtonClicked({ source: 'edit_pane' });
  }, [set]);

  return (
    <Stack direction="column" gap={1}>
      <DragDropContext onDragEnd={onDragEnd}>
        <OptionsPaneCategory
          id={ID_VISIBLE_LIST}
          className={styles.sectionContainer}
          title={t('dashboard-scene.variables-list.title-above-dashboard', 'Above dashboard ({{count}})', {
            count: visible.length,
          })}
        >
          <VariablesSection variables={visible} droppableId={ID_VISIBLE_LIST} onClickVariable={onClickVariable} />
        </OptionsPaneCategory>
        <OptionsPaneCategory
          id={ID_CONTROLS_MENU_LIST}
          className={styles.sectionContainer}
          title={t('dashboard-scene.variables-list.title-controls-menu', 'Controls menu ({{count}})', {
            count: controlsMenu.length,
          })}
        >
          <VariablesSection
            variables={controlsMenu}
            droppableId={ID_CONTROLS_MENU_LIST}
            onClickVariable={onClickVariable}
          />
        </OptionsPaneCategory>
        <OptionsPaneCategory
          id={ID_HIDDEN_LIST}
          className={styles.sectionContainer}
          title={t('dashboard-scene.variables-list.title-hidden', 'Hidden ({{count}})', {
            count: hidden.length,
          })}
        >
          <VariablesSection variables={hidden} droppableId={ID_HIDDEN_LIST} onClickVariable={onClickVariable} />
        </OptionsPaneCategory>
      </DragDropContext>
      <Box display="flex" paddingTop={0} paddingBottom={2}>
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
    </Stack>
  );
}

function VariablesSection({
  variables,
  droppableId,
  onClickVariable,
}: {
  variables: SceneVariable[];
  droppableId: string;
  onClickVariable: (variable: SceneVariable) => void;
}) {
  const styles = useStyles2(getDraggableListStyles);

  const onClickVariableItem = useCallback(
    (variable: SceneVariable) => {
      onClickVariable(variable);
    },
    [onClickVariable]
  );

  return (
    <Droppable droppableId={droppableId} direction="vertical">
      {(provided) => (
        <ul ref={provided.innerRef} {...provided.droppableProps} className={styles.list} data-testid={droppableId}>
          {variables.map((variable, index) => (
            <Draggable
              key={variable.state.key ?? variable.state.name}
              draggableId={variable.state.key ?? variable.state.name}
              index={index}
            >
              {(draggableProvided) => (
                <li ref={draggableProvided.innerRef} {...draggableProvided.draggableProps} className={styles.listItem}>
                  <div {...draggableProvided.dragHandleProps} className={styles.dragHandle}>
                    <Tooltip
                      content={t('dashboard-scene.variables-section.content-drag-to-reorder', 'Drag to reorder')}
                      placement="top"
                    >
                      <Icon name="draggabledots" size="md" />
                    </Tooltip>
                  </div>
                  <div
                    className={styles.itemName}
                    role="button"
                    tabIndex={0}
                    onClick={() => onClickVariableItem(variable)}
                    onKeyDown={(event: React.KeyboardEvent) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onClickVariableItem(variable);
                      }
                    }}
                  >
                    <div data-testid={`${droppableId}-variable-name`}>{variable.state.name}</div>
                    <Stack direction="row" gap={1} alignItems="center">
                      <Button variant="primary" size="sm" fill="outline">
                        <Trans i18nKey="dashboard-scene.variables-section.select">Select</Trans>
                      </Button>
                    </Stack>
                  </div>
                </li>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </ul>
      )}
    </Droppable>
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
