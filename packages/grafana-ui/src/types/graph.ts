import { DisplayValue } from './displayValue';

/** View model projection of a series */
export interface GraphSeriesVM {
  label: string;
  color: string;
  data: any[][]; // [x,y][]
  info?: DisplayValue[]; // Legend info
}
