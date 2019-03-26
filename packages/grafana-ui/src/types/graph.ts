import { DisplayValue } from './displayValue';

export type GraphPlotValue = number | null;

/** View model projection of a series */
export interface GraphPlotVM {
  label: string;
  color: string;
  data: GraphPlotValue[][]; // [x,y][]
  info?: DisplayValue[]; // Legend info
}
