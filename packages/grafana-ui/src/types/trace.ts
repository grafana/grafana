import { DisplayValue } from './displayValue';

/** View model projection of a series */
export interface Trace {
  label: string;
  color: string;
  data: any[][]; // [x,y][]
  info?: DisplayValue[]; // Legend info
}
