import { BusEventWithPayload } from '@grafana/data';

import { SceneObject } from './types';

export interface SceneObjectStateChangedPayload {
  prevState: any;
  newState: any;
  partialUpdate: any;
  changedObject: SceneObject;
}

export class SceneObjectStateChangedEvent extends BusEventWithPayload<SceneObjectStateChangedPayload> {
  static type = 'scene-object-state-change';
}
