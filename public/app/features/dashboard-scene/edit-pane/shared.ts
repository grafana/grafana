/* eslint-disable @grafana/i18n/no-translation-top-level */
import { useSessionStorage } from 'react-use';

import { BusEventWithPayload } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  dataLayers,
  LocalValueVariable,
  SceneGridRow,
  type SceneObject,
  type SceneVariable,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';
import { type ElementSelectionContextItem } from '@grafana/ui';

import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardScene } from '../scene/DashboardScene';
import { SceneGridRowEditableElement } from '../scene/layout-default/SceneGridRowEditableElement';
import { type BulkActionElement, isBulkActionElement } from '../scene/types/BulkActionElement';
import { type EditableDashboardElement, isEditableDashboardElement } from '../scene/types/EditableDashboardElement';
import { AnnotationEditableElement } from '../settings/annotations/AnnotationEditableElement';
import { AnnotationSetEditableElement } from '../settings/annotations/AnnotationSetEditableElement';
import { LinkEdit, LinkEditEditableElement } from '../settings/links/LinkAddEditableElement';
import { LocalVariableEditableElement } from '../settings/variables/LocalVariableEditableElement';
import { VariableEditableElement } from '../settings/variables/VariableEditableElement';
import { VariableSetEditableElement } from '../settings/variables/VariableSetEditableElement';
import { isSceneVariable } from '../settings/variables/utils';

import { type DashboardEditPane } from './DashboardEditPane';
import { MultiSelectedObjectsEditableElement } from './MultiSelectedObjectsEditableElement';
import { VizPanelEditableElement } from './VizPanelEditableElement';
import { DashboardEditableElement } from './dashboard/DashboardEditableElement';
import { DashboardEditActionEvent, type DashboardEditActionEventPayload } from './events';

export const EDIT_PANE_COLLAPSED_KEY = 'grafana.dashboards.edit-pane.isCollapsed';

export function useEditPaneCollapsed() {
  return useSessionStorage(EDIT_PANE_COLLAPSED_KEY, false);
}

export function getEditableElementForSelection(
  editPane: DashboardEditPane,
  selected: ElementSelectionContextItem[]
): EditableDashboardElement | undefined {
  if (selected.length === 1) {
    const obj = editPane.getSelectedObject(selected[0].id);
    if (obj) {
      return getEditableElementFor(obj);
    }
  }

  if (selected.length > 1) {
    const objects = selected.map((s) => editPane.getSelectedObject(s.id));
    const elements: BulkActionElement[] = objects
      .map((obj) => getEditableElementFor(obj))
      .filter((e): e is BulkActionElement => Boolean(e) && isBulkActionElement(e!));

    if (elements.length === 0) {
      return undefined;
    }

    const first = elements[0];
    const allSameType = elements.every((e) => e.constructor.name === first.constructor.name);

    if (allSameType && first.createMultiSelectedElement) {
      return first.createMultiSelectedElement(elements);
    }

    return new MultiSelectedObjectsEditableElement(elements);
  }

  return undefined;
}

export function getEditableElementFor(sceneObj: SceneObject | undefined | null): EditableDashboardElement | undefined {
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

  if (sceneObj instanceof LinkEdit) {
    return new LinkEditEditableElement(sceneObj);
  }

  if (sceneObj instanceof DashboardDataLayerSet) {
    return new AnnotationSetEditableElement(sceneObj);
  }

  if (sceneObj instanceof dataLayers.AnnotationsDataLayer) {
    return new AnnotationEditableElement(sceneObj);
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

export class RepeatsUpdatedEvent extends BusEventWithPayload<SceneObject> {
  static type = 'repeats-updated';
}

export { DashboardEditActionEvent, DashboardStateChangedEvent, type DashboardEditActionEventPayload } from './events';

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

export interface ChangeVariableTypeActionHelperProps {
  oldVariable: SceneVariable;
  newVariable: SceneVariable;
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
    const varsBeforeAddition = [...(source.state.variables ?? [])];

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
  changeVariableType({ source, oldVariable, newVariable }: ChangeVariableTypeActionHelperProps) {
    const varsBeforeChange = [...source.state.variables];
    const variableIndex = varsBeforeChange.indexOf(oldVariable);

    if (variableIndex === -1) {
      throw new Error('Variable not found in source set');
    }

    const varsAfterChange = [...varsBeforeChange];
    varsAfterChange[variableIndex] = newVariable;

    dashboardEditActions.edit({
      description: t('dashboard.variable.type.action', 'Change variable type'),
      source,
      addedObject: newVariable,
      removedObject: oldVariable,
      perform() {
        source.setState({ variables: varsAfterChange });
      },
      undo() {
        source.setState({ variables: varsBeforeChange });
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
  changeVariableHideValue({ source, oldValue, newValue }: EditActionProps<SceneVariable, 'hide'>) {
    const variableSet = source.parent;
    const variablesBeforeChange =
      variableSet instanceof SceneVariableSet ? [...(variableSet.state.variables ?? [])] : undefined;

    dashboardEditActions.edit({
      description: t('dashboard.variable.hide.action', 'Change variable hide option'),
      source,
      perform: () => {
        source.setState({ hide: newValue });
        // Updating the variables set since components that show/hide variables subscribe to the variable set, not the individual variables.
        if (variableSet instanceof SceneVariableSet) {
          variableSet.setState({ variables: [...(variableSet.state.variables ?? [])] });
        }
      },
      undo: () => {
        source.setState({ hide: oldValue });
        if (variableSet instanceof SceneVariableSet && variablesBeforeChange) {
          variableSet.setState({ variables: variablesBeforeChange });
        }
      },
    });
  },

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

export function makeEditAction<Source extends SceneObject, T extends keyof Source['state']>({
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
