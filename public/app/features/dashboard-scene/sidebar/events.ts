// Extracted from shared.ts to avoid circular dependency through DashboardScene.
import { BusEventBase, BusEventWithPayload } from '@grafana/data';
import { type SceneObject } from '@grafana/scenes';

export interface DashboardActionMeta {
  /**
   * Reported with undo/redo interactions. Format: `<element>.<action>`, describing the action as the user
   * perceives it: the main UI element involved and what is done to it (e.g. `panel.remove`, `row.changeTitle`).
   */
  actionId: `${string}.${string}`;
  /**
   * Free-text narrowing of the actionId, set only when several places report the same actionId
   * (e.g. `panel.remove` from `auto-grid` vs `custom-grid`).
   */
  scope?: string;
  /** Who made the edit when it isn't the user in the dashboard UI (e.g. `mutation-api`). */
  actor?: string;
}

export interface DashboardEditActionEventPayload {
  meta: DashboardActionMeta;
  removedObject?: SceneObject;
  addedObject?: SceneObject;
  movedObject?: SceneObject;
  selectOnMove?: boolean;
  source: SceneObject;
  description?: string;
  perform: () => void;
  undo: () => void;
}

export class DashboardEditActionEvent extends BusEventWithPayload<DashboardEditActionEventPayload> {
  static type = 'dashboard-edit-action';
}

export interface DashboardBatchEditActionEventPayload {
  meta: DashboardActionMeta;
  source: SceneObject;
  description?: string;
}

export class DashboardBatchEditActionStartEvent extends BusEventWithPayload<DashboardBatchEditActionEventPayload> {
  static type = 'dashboard-batch-edit-action-start';
}

export class DashboardBatchEditActionEndEvent extends BusEventBase {
  static type = 'dashboard-batch-edit-action-end';
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

/**
 * Why a sidebar pane closed. 'explicit' is the user closing it on purpose (pane header close button,
 * sidebar toggle, hide sidebar button). 'click-away' is an undocked pane closing because the pointer
 * went down somewhere else. Everything else, the default, is 'programmatic'.
 */
export type PaneCloseReason = 'explicit' | 'click-away' | 'programmatic';

export class PaneClosedEvent extends BusEventWithPayload<{ pane: SceneObject; reason: PaneCloseReason }> {
  static type = 'sidebar-pane-closed';
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
