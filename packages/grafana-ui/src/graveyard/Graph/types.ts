/** @deprecated */
export interface FlotItem<T> {
  datapoint: [number, number];
  dataIndex: number;
  series: T;
  seriesIndex: number;
  pageX: number;
  pageY: number;
}
