import { DisplayValue } from './displayValue';

export interface YAxis {
  index: number;
  min?: number;
  tickDecimals?: number;
}

export type GraphSeriesValue = number | null;

/** View model projection of a series */
export interface GraphSeriesXY {
  label: string;
  color: string;
  data: GraphSeriesValue[][]; // [x,y][]
  info?: DisplayValue[]; // Legend info
  isVisible: boolean;
  yAxis: YAxis;
}

export interface CreatePlotOverlay {
  (element: JQuery, event: any, plot: { getOptions: () => { events: { manager: any } } }): any;
}
