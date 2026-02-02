import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { useCallback, useId, useMemo } from 'react';

import { GrafanaTheme2, VariableHide } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { SceneVariable, SceneVariableSet } from '@grafana/scenes';
import { Box, Button, Icon, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { dashboardEditActions } from '../../edit-pane/shared';
import { DashboardScene } from '../../scene/DashboardScene';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';
import { DashboardInteractions } from '../../utils/interactions';
import { getDashboardSceneFor } from '../../utils/utils';

import { openAddVariablePane } from './VariableAddEditableElement';
import { isEditableVariableType } from './utils';

function useEditPaneOptions(this: VariableSetEditableElement, set: SceneVariableSet): OptionsPaneCategoryDescriptor[] {
  const variableListId = useId();
  const options = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({ title: '', id: 'variables' }).addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: variableListId,
        skipField: true,
        render: () => <VariableList set={set} />,
      })
    );
  }, [set, variableListId]);

  return [options];
}

function partitionVariables(variables: SceneVariable[]) {
  const standardVariables: SceneVariable[] = [];
  const controlsMenuVariables: SceneVariable[] = [];

  variables.forEach((variable) => {
    if (variable.state.hide === VariableHide.inControlsMenu) {
      controlsMenuVariables.push(variable);
    } else {
      standardVariables.push(variable);
    }
  });

  return { standardVariables, controlsMenuVariables };
}

export class VariableSetEditableElement implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;
  public readonly typeName = 'Variable';

  public constructor(private set: SceneVariableSet) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.variable-set', 'Variables'),
      icon: 'x',
      instanceName: t('dashboard.edit-pane.elements.variable-set', 'Variables'),
    };
  }

  public getOutlineChildren() {
    const { standardVariables, controlsMenuVariables } = partitionVariables(
      this.set.state.variables
        // filter out system and snapshot variables
        .filter((variable) => isEditableVariableType(variable.state.type))
    );
    return [...standardVariables, ...controlsMenuVariables];
  }

  public useEditPaneOptions = useEditPaneOptions.bind(this, this.set);
}

export function VariableList({ set }: { set: SceneVariableSet }) {
  const styles = useStyles2(getStyles);
  const { variables } = set.useState();

  const canAdd = set.parent instanceof DashboardScene;
  const onAddVariable = useCallback(() => {
    openAddVariablePane(getDashboardSceneFor(set));
    DashboardInteractions.addVariableButtonClicked({ source: 'edit_pane' });
  }, [set]);

  const onEditVariable = useCallback(
    (variable: SceneVariable) => {
      const { editPane } = getDashboardSceneFor(set).state;
      editPane.selectObject(variable, variable.state.key!);
    },
    [set]
  );

  const { editableVariables, nonEditableVariables } = useMemo(() => {
    const editableVariables: SceneVariable[] = [];
    const nonEditableVariables: SceneVariable[] = [];
    variables.forEach((variable) => {
      if (isEditableVariableType(variable.state.type)) {
        editableVariables.push(variable);
      } else {
        nonEditableVariables.push(variable);
      }
    });
    return {
      editableVariables,
      nonEditableVariables,
    };
  }, [variables]);

  const { standardVariables, controlsMenuVariables } = useMemo(
    () => partitionVariables(editableVariables),
    [editableVariables]
  );

  const createDragEndHandler = useCallback(
    (sourceList: SceneVariable[], mergeLists: (updatedList: SceneVariable[]) => SceneVariable[]) => {
      return (result: DropResult) => {
        const currentList = set.state.variables;

        dashboardEditActions.edit({
          source: set,
          description: t(
            'dashboard-scene.variable-list.create-drag-end-handler.description.reorder-variables-list',
            'Reorder variables list'
          ),
          perform: () => {
            if (!result.destination || result.destination.index === result.source.index) {
              return;
            }

            reportInteraction('Variable drag and drop');

            const updatedList = [...sourceList];
            const [movedVariable] = updatedList.splice(result.source.index, 1);
            updatedList.splice(result.destination.index, 0, movedVariable);

            set.setState({
              variables: [...nonEditableVariables, ...mergeLists(updatedList)],
            });
          },
          undo: () => {
            set.setState({ variables: currentList });
          },
        });
      };
    },
    [nonEditableVariables, set]
  );

  const onStandardDragEnd = useMemo(
    () => createDragEndHandler(standardVariables, (updatedList) => [...updatedList, ...controlsMenuVariables]),
    [controlsMenuVariables, createDragEndHandler, standardVariables]
  );

  const onControlsDragEnd = useMemo(
    () => createDragEndHandler(controlsMenuVariables, (updatedList) => [...standardVariables, ...updatedList]),
    [controlsMenuVariables, createDragEndHandler, standardVariables]
  );

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    event.stopPropagation();
  }, []);

  const renderList = (list: SceneVariable[], droppableId: string) => (
    <Droppable droppableId={droppableId} direction="vertical">
      {(provided) => (
        <Stack ref={provided.innerRef} {...provided.droppableProps} direction="column" gap={0}>
          {list.map((variable, index) => (
            <Draggable
              key={variable.state.key ?? variable.state.name}
              draggableId={`${variable.state.key ?? variable.state.name}`}
              index={index}
            >
              {(draggableProvided) => (
                // TODO fix keyboard a11y here
                // eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events
                <div
                  className={styles.variableItem}
                  key={variable.state.name}
                  onClick={() => onEditVariable(variable)}
                  ref={draggableProvided.innerRef}
                  {...draggableProvided.draggableProps}
                >
                  <div className={styles.variableContent}>
                    <div {...draggableProvided.dragHandleProps} onPointerDown={onPointerDown}>
                      <Tooltip content={t('dashboard.edit-pane.variables.reorder', 'Drag to reorder')} placement="top">
                        <Icon name="draggabledots" size="md" className={styles.dragHandle} />
                      </Tooltip>
                    </div>
                    <Text>${variable.state.name}</Text>
                    {variable.state.hide === VariableHide.hideVariable && (
                      <Icon name="eye-slash" size="sm" className={styles.hiddenIcon} />
                    )}
                    {variable.state.hide === VariableHide.inControlsMenu && (
                      <Icon name="sliders-v-alt" size="sm" className={styles.hiddenIcon} />
                    )}
                  </div>
                  <Stack direction="row" gap={1} alignItems="center">
                    <Button variant="primary" size="sm" fill="outline">
                      <Trans i18nKey="dashboard.edit-pane.variables.select-variable">Select</Trans>
                    </Button>
                  </Stack>
                </div>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </Stack>
      )}
    </Droppable>
  );

  return (
    <Stack direction="column" gap={1}>
      <DragDropContext onDragEnd={onStandardDragEnd}>
        {renderList(standardVariables, 'variables-outline-standard')}
      </DragDropContext>
      {controlsMenuVariables.length > 0 && (
        <DragDropContext onDragEnd={onControlsDragEnd}>
          {renderList(controlsMenuVariables, 'variables-outline-controls')}
        </DragDropContext>
      )}
      {canAdd && (
        <Box paddingBottom={1} paddingTop={1} display={'flex'}>
          <Button
            fullWidth
            icon="plus"
            size="sm"
            variant="secondary"
            onClick={onAddVariable}
            data-testid={selectors.components.PanelEditor.ElementEditPane.addVariableButton}
          >
            <Trans i18nKey="dashboard.edit-pane.variables.add-variable">Add variable</Trans>
          </Button>
        </Box>
      )}
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    variableItem: css({
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['color'], {
          duration: theme.transitions.duration.short,
        }),
      },
      button: {
        visibility: 'hidden',
      },
      '&:hover': {
        color: theme.colors.text.link,
        button: {
          visibility: 'visible',
        },
      },
    }),
    variableContent: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
    dragHandle: css({
      display: 'flex',
      alignItems: 'center',
      cursor: 'grab',
      color: theme.colors.text.secondary,
      '&:active': {
        cursor: 'grabbing',
      },
    }),
    hiddenIcon: css({
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing(1),
    }),
  };
}
