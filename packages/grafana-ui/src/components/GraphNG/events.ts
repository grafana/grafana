import { BusEventBase, BusEventWithPayload } from '@grafana/data';

/** @alpha */
export interface SetGraphCursorEventPayload {
  point: { time: number };
}

/**
 * Event used for one-way communication to set cursor at all time series panel at given time
 * @alpha
 */
export class SetGraphNGCursorEvent extends BusEventWithPayload<SetGraphCursorEventPayload> {
  static type = 'graph-ng-set-cursor';
}

/** @alpha */
export class ClearGraphNGCursorEvent extends BusEventBase {
  static type = 'graph-ng-clear-cursor';
}
