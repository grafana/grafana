import { AnnotationEvent, DataFrame } from '../types';

import { BusEventBase, BusEventWithPayload } from './types';

/**
 * When hovering over an element this will identify
 *
 * For performance reasons, this object will usually be mutated between updates.  This
 * will avoid creating new objects for events that fire frequently (ie each mouse pixel)
 *
 * @alpha
 */
export interface DataHoverPayload {
  data?: DataFrame; // source data
  rowIndex?: number; // the hover row
  columnIndex?: number; // the hover column
  dataId?: string; // identifying string to correlate data between publishers and subscribers

  // When dragging, this will capture the point when the mouse was down
  point: Record<string, any>; // { time: 5678, lengthft: 456 }  // each axis|scale gets a value
  down?: Record<string, any>;
}

/** @alpha */
export class DataHoverEvent extends BusEventWithPayload<DataHoverPayload> {
  static type = 'data-hover';
}

/** @alpha */
export class DataHoverClearEvent extends BusEventBase {
  static type = 'data-hover-clear';
}

/** @alpha */
export class DataSelectEvent extends BusEventWithPayload<DataHoverPayload> {
  static type = 'data-select';
}

/** @alpha */
export class AnnotationChangeEvent extends BusEventWithPayload<Partial<AnnotationEvent>> {
  static type = 'annotation-event';
}

// Loaded the first time a dashboard is loaded (not on every render)
export type DashboardLoadedEventPayload<T> = {
  dashboardId: string; // eeep, this should be UID
  orgId?: number;
  userId?: number;
  grafanaVersion?: string;
  queries: Record<string, T[]>;
};

/** @alpha */
export class DashboardLoadedEvent<T> extends BusEventWithPayload<DashboardLoadedEventPayload<T>> {
  static type = 'dashboard-loaded';
}
