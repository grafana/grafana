import { useSessionStorage } from 'react-use';

import { BusEventWithPayload } from '@grafana/data';
import { SceneGridRow, SceneObject, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { SceneGridRowEditableElement } from '../scene/layout-default/SceneGridRowEditableElement';
import { EditableDashboardElement, isEditableDashboardElement } from '../scene/types/EditableDashboardElement';

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

  return undefined;
}

export function hasEditableElement(sceneObj: SceneObject | undefined): boolean {
  if (!sceneObj) {
    return false;
  }

  if (
    isEditableDashboardElement(sceneObj) ||
    sceneObj instanceof VizPanel ||
    sceneObj instanceof SceneGridRow ||
    sceneObj instanceof DashboardScene
  ) {
    return true;
  }

  return false;
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
