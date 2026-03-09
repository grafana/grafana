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
