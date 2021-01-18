import { DataFrame } from '../types';
import { BusEventWithPayload } from './types';

/** @alpha */
export interface DataHoverPayload {
  raw: any; // Original mouse event (includes pageX etc)

  x: Record<string, number>; // { time: 5678 },
  y: Record<string, number>; // { __fixed: 123, lengthft: 456 }  // each axis|scale gets a value

  data?: DataFrame; // source data
  rowIndex?: number; // the hover row
  columnIndex?: number; // the hover column

  // Drag events
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
