// Extracted from shared.ts to avoid circular dependency through DashboardScene.
import { BusEventBase, BusEventWithPayload } from '@grafana/data';
import { type SceneObject } from '@grafana/scenes';

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

export class ToggleViewPanePaneEvent extends BusEventBase {
  static type = 'toggle-view-pane-pane';
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
