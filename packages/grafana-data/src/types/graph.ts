import { DisplayValue } from './displayValue';
import { Field } from './dataFrame';

export interface YAxis {
  index: number;
  min?: number;
  tickDecimals?: number;
}

export type GraphSeriesValue = number | null;

/** View model projection of a series */
export interface GraphSeriesXY {
  color?: string;
  data: GraphSeriesValue[][]; // [x,y][]
  isVisible: boolean;
  label: string;
  yAxis: YAxis;
  // Field with series' time values
  timeField: Field;
  // Field with series' values
  valueField: Field;
  seriesIndex: number;
  timeStep: number;

  info?: DisplayValue[]; // Legend info
}

export interface CreatePlotOverlay {
  (element: JQuery, event: any, plot: { getOptions: () => { events: { manager: any } } }): any;
}
