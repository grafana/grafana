import { type DropResult } from '@hello-pangea/dnd';

import { VariableHide } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneVariableSet, type SceneVariable } from '@grafana/scenes';
import { appEvents } from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { edit } from '../../actions/utils/edit';
import { removeVariable } from '../../actions/variable/removeVariable';

export function confirmDeleteVariable(variable: SceneVariable) {
  appEvents.publish(
    new ShowConfirmModalEvent({
      title: t('dashboard-scene.variable-editable-element.delete-title', 'Delete variable'),
      text: t('dashboard-scene.variable-editable-element.delete-text', 'Are you sure you want to delete: {{name}}?', {
        name: variable.state.name,
      }),
      yesText: t('dashboard-scene.variable-editable-element.delete-confirm', 'Delete variable'),
      onConfirm: () => {
        const set = variable.parent;
        if (set instanceof SceneVariableSet) {
          removeVariable({ source: set, removedObject: variable });
        }
      },
    })
  );
}

export interface ListIds {
  visible: string;
  controlsMenu: string;
  hidden: string;
}

function getTargetHide(
  droppableId: string,
  currentHide: VariableHide,
  visibleListId: string,
  droppableToHide: Record<string, VariableHide>
): VariableHide {
  if (droppableId === visibleListId) {
    return currentHide === VariableHide.dontHide || currentHide === VariableHide.hideLabel
      ? currentHide
      : VariableHide.dontHide;
  }
  return droppableToHide[droppableId];
}

export function createDragEndHandler(
  variableSet: SceneVariableSet,
  listIds: ListIds,
  visible: SceneVariable[],
  controlsMenu: SceneVariable[],
  hidden: SceneVariable[],
  description: string,
  droppableToHide: Record<string, VariableHide>
) {
  return (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) {
      return;
    }

    const isSameList = source.droppableId === destination.droppableId;
    if (isSameList && source.index === destination.index) {
      return;
    }

    const currentVariables = variableSet.state.variables;
    const lists: Record<string, SceneVariable[]> = {
      [listIds.visible]: [...visible],
      [listIds.controlsMenu]: [...controlsMenu],
      [listIds.hidden]: [...hidden],
    };

    const sourceList = lists[source.droppableId];
    const destList = isSameList ? sourceList : lists[destination.droppableId];

    const [moved] = sourceList.splice(source.index, 1);
    destList.splice(destination.index, 0, moved);

    const oldHide = moved.state.hide ?? VariableHide.dontHide;
    const newHide = getTargetHide(destination.droppableId, oldHide, listIds.visible, droppableToHide);

    const reordered = [...lists[listIds.visible], ...lists[listIds.controlsMenu], ...lists[listIds.hidden]];
    const draggableSet = new Set(reordered);

    edit({
      source: variableSet,
      description,
      perform: () => {
        if (newHide !== oldHide) {
          moved.setState({ hide: newHide });
        }

        let reorderedIdx = 0;
        const merged = currentVariables.map((v) => (draggableSet.has(v) ? reordered[reorderedIdx++] : v));

        variableSet.setState({ variables: merged });
      },
      undo: () => {
        if (newHide !== oldHide) {
          moved.setState({ hide: oldHide });
        }
        variableSet.setState({ variables: currentVariables });
      },
    });
  };
}
