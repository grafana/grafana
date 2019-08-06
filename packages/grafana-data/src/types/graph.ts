import { DisplayValue } from './displayValue';

export type GraphSeriesValue = number | null;

/** View model projection of a series */
export interface GraphSeriesXY {
  label: string;
  color: string;
  data: GraphSeriesValue[][]; // [x,y][]
  info?: DisplayValue[]; // Legend info
  isVisible: boolean;
  yAxis: number;
}

export interface CreatePlotOverlay {
  (element: JQuery, event: any, plot: { getOptions: () => { events: { manager: any } } }): any;
}
