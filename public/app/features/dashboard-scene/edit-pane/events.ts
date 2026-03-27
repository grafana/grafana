// Extracted from shared.ts to avoid circular dependency through DashboardScene.
import { BusEventWithPayload } from '@grafana/data';
import { SceneObject } from '@grafana/scenes';

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
