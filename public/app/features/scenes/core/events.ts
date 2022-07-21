import { BusEventWithPayload } from '@grafana/data';

import { SceneObject, SceneObjectState, SceneObjectWithUrlSync } from './types';

export interface SceneObjectStateChangedPayload {
  prevState: SceneObjectState;
  newState: SceneObjectState;
  partialUpdate: Partial<SceneObjectState>;
  changedObject: SceneObject | SceneObjectWithUrlSync;
}

export class SceneObjectStateChangedEvent extends BusEventWithPayload<SceneObjectStateChangedPayload> {
  static type = 'scene-object-state-change';
}
