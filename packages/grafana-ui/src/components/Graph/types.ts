/** @deprecated */
export interface FlotPosition {
  pageX: number;
  pageY: number;
  x: number;
  x1: number;
  y: number;
  y1: number;
}

/** @deprecated */
export interface FlotItem<T> {
  datapoint: [number, number];
  dataIndex: number;
  series: T;
  seriesIndex: number;
  pageX: number;
  pageY: number;
}
