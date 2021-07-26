import { DataFrame, TimeRange, AnnotationEvent } from '../types';
import { BusEventWithPayload } from './types';

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
export class DataHoverClearEvent extends BusEventWithPayload<DataHoverPayload> {
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

/**
 * This event is fired when the time on a dashboard should update, even if the data has not
 * been refreshed.  This will help support panels that should "move left" while in live mode
 *
 * These events will fire depending on the curent time window and browser width
 *
 * @alpha
 */
export class LiveDashboardTick extends BusEventWithPayload<TimeRange> {
  static type = 'live-tick';
}
