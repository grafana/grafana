import { BusEventWithPayload } from '@grafana/data';

import { SceneObject } from './types';

export interface SceneObjectStatePlainChangedPayload {
  prevState: any;
  newState: any;
  partialUpdate: any;
  changedObject: SceneObject;
}

export class SceneObjectStatePlainChangedEvent extends BusEventWithPayload<SceneObjectStatePlainChangedPayload> {
  static type = 'scene-object-state-change';
}
