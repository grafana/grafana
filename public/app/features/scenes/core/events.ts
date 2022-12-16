import { BusEventWithPayload } from '@grafana/data';

import { SceneObject, SceneObjectState } from './types';

export interface SceneObjectStateChangedPayload {
  prevState: SceneObjectState;
  newState: SceneObjectState;
  partialUpdate: Partial<SceneObjectState>;
  changedObject: SceneObject;
}

export class SceneObjectStateChangedEvent extends BusEventWithPayload<SceneObjectStateChangedPayload> {
  public static readonly type = 'scene-object-state-change';
}
