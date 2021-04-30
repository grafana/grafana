import { DataFrame } from '../types';
import { BusEventWithPayload } from './types';

/** @alpha */
export interface DataHoverPayload {
  raw: any; // Original mouse event (includes pageX etc)

  x: Record<string, any>; // { time: 5678 },
  y: Record<string, any>; // { __fixed: 123, lengthft: 456 }  // each axis|scale gets a value

  data?: DataFrame; // source data
  rowIndex?: number; // the hover row
  columnIndex?: number; // the hover column
  dataId?: string; // identifying string to correlate data between publishers and subscribers

  // When dragging, this will capture the original state
  down?: Omit<DataHoverPayload, 'down'>;
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
