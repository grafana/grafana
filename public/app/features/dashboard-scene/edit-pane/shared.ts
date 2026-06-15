import { useSessionStorage } from 'react-use';

import { BusEventWithPayload } from '@grafana/data';
import {
  dataLayers,
  LocalValueVariable,
  SceneGridRow,
  type SceneObject,
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
import { addElement } from './dashboardEditActions/addElement';
import { addVariable } from './dashboardEditActions/addVariable';
import { changeDescription } from './dashboardEditActions/changeDescription';
import { changeTitle } from './dashboardEditActions/changeTitle';
import { changeVariableDescription } from './dashboardEditActions/changeVariableDescription';
import { changeVariableHideValue } from './dashboardEditActions/changeVariableHideValue';
import { changeVariableLabel } from './dashboardEditActions/changeVariableLabel';
import { changeVariableName } from './dashboardEditActions/changeVariableName';
import { changeVariableType } from './dashboardEditActions/changeVariableType';
import { edit } from './dashboardEditActions/edit';
import { moveElement } from './dashboardEditActions/moveElement';
import { removeElement } from './dashboardEditActions/removeElement';
import { removeVariable } from './dashboardEditActions/removeVariable';

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

/**
 * Dashboard edit actions.
 *
 * `edit` is the low-level primitive; the rest are thin, named wrappers around it.
 * Each one lives in its own file under ./dashboardEditActions — add new actions
 * there and wire them into this object. Aggregated here (rather than in a dedicated
 * index that shared.ts re-exports) so existing `dashboardEditActions` imports from
 * this module keep working unchanged.
 */
export const dashboardEditActions = {
  edit,
  addElement,
  removeElement,
  changeTitle,
  changeDescription,
  addVariable,
  removeVariable,
  changeVariableType,
  changeVariableName,
  changeVariableLabel,
  changeVariableDescription,
  changeVariableHideValue,
  moveElement,
};
