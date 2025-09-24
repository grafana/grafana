/* eslint-disable @grafana/i18n/no-translation-top-level */
import { useSessionStorage } from 'react-use';

import { BusEventWithPayload } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  LocalValueVariable,
  SceneGridRow,
  SceneObject,
  SceneVariable,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { SceneGridRowEditableElement } from '../scene/layout-default/SceneGridRowEditableElement';
import { redoButtonId, undoButtonID } from '../scene/new-toolbar/RightActions';
import { EditableDashboardElement, isEditableDashboardElement } from '../scene/types/EditableDashboardElement';
import { LocalVariableEditableElement } from '../settings/variables/LocalVariableEditableElement';
import { VariableEditableElement } from '../settings/variables/VariableEditableElement';
import { VariableSetEditableElement } from '../settings/variables/VariableSetEditableElement';
import { isSceneVariable } from '../settings/variables/utils';

import { DashboardEditableElement } from './DashboardEditableElement';
import { VizPanelEditableElement } from './VizPanelEditableElement';

export function useEditPaneCollapsed() {
  return useSessionStorage('grafana.dashboards.edit-pane.isCollapsed', false);
}

export function getEditableElementFor(sceneObj: SceneObject | undefined): EditableDashboardElement | undefined {
  if (!sceneObj) {
    return undefined;
  }

  if (isEditableDashboardElement(sceneObj)) {
    return sceneObj;
  }

  if (sceneObj instanceof VizPanel) {
    return new VizPanelEditableElement(sceneObj);
  }

  if (sceneObj instanceof SceneGridRow) {
    return new SceneGridRowEditableElement(sceneObj);
  }

  if (sceneObj instanceof DashboardScene) {
    return new DashboardEditableElement(sceneObj);
  }

  if (sceneObj instanceof SceneVariableSet) {
    return new VariableSetEditableElement(sceneObj);
  }

  if (sceneObj instanceof LocalValueVariable) {
    return new LocalVariableEditableElement(sceneObj);
  }

  if (isSceneVariable(sceneObj)) {
    return new VariableEditableElement(sceneObj);
  }

  return undefined;
}

export class NewObjectAddedToCanvasEvent extends BusEventWithPayload<SceneObject> {
  static type = 'new-object-added-to-canvas';
}

export class ObjectRemovedFromCanvasEvent extends BusEventWithPayload<SceneObject> {
  static type = 'object-removed-from-canvas';
}

export class ObjectsReorderedOnCanvasEvent extends BusEventWithPayload<SceneObject> {
  static type = 'objects-reordered-on-canvas';
}

export class ConditionalRenderingChangedEvent extends BusEventWithPayload<SceneObject> {
  static type = 'conditional-rendering-changed';
}

export interface DashboardEditActionEventPayload {
  removedObject?: SceneObject;
  addedObject?: SceneObject;
  movedObject?: SceneObject;
  source: SceneObject;
  description?: string;
  perform: () => void;
  undo: () => void;
}

export class DashboardEditActionEvent extends BusEventWithPayload<DashboardEditActionEventPayload> {
  static type = 'dashboard-edit-action';
}

/**
 * Emitted after DashboardEditActionEvent has been processed (or undone)
 */
export class DashboardStateChangedEvent extends BusEventWithPayload<{ source: SceneObject }> {
  static type = 'dashboard-state-changed';
}

export interface AddElementActionHelperProps {
  addedObject: SceneObject;
  source: SceneObject;
  perform: () => void;
  undo: () => void;
}

export interface RemoveElementActionHelperProps {
  removedObject: SceneObject;
  source: SceneObject;
  perform: () => void;
  undo: () => void;
}

export interface AddVariableActionHelperProps {
  addedObject: SceneVariable;
  source: SceneVariableSet;
}

export interface RemoveVariableActionHelperProps {
  removedObject: SceneVariable;
  source: SceneVariableSet;
}

export interface ChangeTitleActionHelperProps {
  oldTitle: string;
  newTitle: string;
  source: DashboardScene;
}

export interface ChangeDescriptionActionHelperProps {
  oldDescription: string;
  newDescription: string;
  source: DashboardScene;
}

export interface MoveElementActionHelperProps {
  movedObject: SceneObject;
  source: SceneObject;
  perform: () => void;
  undo: () => void;
}

export const dashboardEditActions = {
  /**
   * Registers and peforms an edit action
   */
  edit(props: DashboardEditActionEventPayload) {
    props.source.publishEvent(new DashboardEditActionEvent(props), true);
  },
  /**
   * Helper for makeEdit that adds elements
   */
  addElement(props: AddElementActionHelperProps) {
    const { addedObject, source, perform, undo } = props;

    const element = getEditableElementFor(addedObject);
    if (!element) {
      throw new Error('Added object is not an editable element');
    }

    const typeName = element.getEditableElementInfo().typeName;

    dashboardEditActions.edit({
      description: t('dashboard.edit-actions.add', 'Add {{typeName}}', { typeName }),
      addedObject,
      source,
      perform,
      undo,
    });
  },

  removeElement(props: RemoveElementActionHelperProps) {
    const { removedObject, source, perform, undo } = props;

    const element = getEditableElementFor(removedObject);
    if (!element) {
      throw new Error('Removed object is not an editable element');
    }

    const typeName = element.getEditableElementInfo().typeName;

    dashboardEditActions.edit({
      description: t('dashboard.edit-actions.remove', 'Remove {{typeName}}', { typeName }),
      removedObject,
      source,
      perform,
      undo,
    });
  },

  changeTitle: makeEditAction<DashboardScene, 'title'>({
    description: t('dashboard.title.action', 'Change dashboard title'),
    prop: 'title',
  }),
  changeDescription: makeEditAction<DashboardScene, 'description'>({
    description: t('dashboard.description.action', 'Change dashboard description'),
    prop: 'description',
  }),

  addVariable({ source, addedObject }: AddVariableActionHelperProps) {
    const varsBeforeAddition = [...source.state.variables];

    dashboardEditActions.addElement({
      source,
      addedObject,
      perform() {
        source.setState({ variables: [...varsBeforeAddition, addedObject] });
      },
      undo() {
        source.setState({ variables: [...varsBeforeAddition] });
      },
    });
  },
  removeVariable({ source, removedObject }: RemoveVariableActionHelperProps) {
    const varsBeforeRemoval = [...source.state.variables];

    dashboardEditActions.removeElement({
      source,
      removedObject,
      perform() {
        source.setState({ variables: varsBeforeRemoval.filter((v) => v !== removedObject) });
      },
      undo() {
        source.setState({ variables: varsBeforeRemoval });
      },
    });
  },
  changeVariableName: makeEditAction<SceneVariable, 'name'>({
    description: t('dashboard.variable.name.action', 'Change variable name'),
    prop: 'name',
  }),
  changeVariableLabel: makeEditAction<SceneVariable, 'label'>({
    description: t('dashboard.variable.label.action', 'Change variable label'),
    prop: 'label',
  }),
  changeVariableDescription: makeEditAction<SceneVariable, 'description'>({
    description: t('dashboard.variable.description.action', 'Change variable description'),
    prop: 'description',
  }),
  changeVariableHideValue: makeEditAction<SceneVariable, 'hide'>({
    description: t('dashboard.variable.hide.action', 'Change variable hide option'),
    prop: 'hide',
  }),

  moveElement(props: MoveElementActionHelperProps) {
    const { movedObject, source, perform, undo } = props;

    const element = getEditableElementFor(movedObject);
    if (!element) {
      throw new Error('Moved object is not an editable element');
    }

    const typeName = element.getEditableElementInfo().typeName;

    dashboardEditActions.edit({
      description: t('dashboard.edit-actions.move', 'Move {{typeName}}', { typeName }),
      movedObject,
      source,
      perform,
      undo,
    });
  },
};

interface MakeEditActionProps<Source extends SceneObject, T extends keyof Source['state']> {
  description: string;
  prop: T;
}

interface EditActionProps<Source extends SceneObject, T extends keyof Source['state']> {
  source: Source;
  oldValue: Source['state'][T];
  newValue: Source['state'][T];
}

function makeEditAction<Source extends SceneObject, T extends keyof Source['state']>({
  description,
  prop,
}: MakeEditActionProps<Source, T>) {
  return ({ source, oldValue, newValue }: EditActionProps<Source, T>) => {
    dashboardEditActions.edit({
      description,
      source,
      perform: () => {
        source.setState({ [prop]: newValue });
      },
      undo: () => {
        source.setState({ [prop]: oldValue });
      },
    });
  };
}

export function undoRedoWasClicked(e: React.FocusEvent) {
  return e.relatedTarget && (e.relatedTarget.id === undoButtonID || e.relatedTarget.id === redoButtonId);
}
