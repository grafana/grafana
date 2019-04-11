import { StatDisplayValue } from '../components/Legend/Legend';

export type GraphSeriesValue = number | null;

/** View model projection of a series */
export interface GraphSeriesXY {
  label: string;
  color: string;
  data: GraphSeriesValue[][]; // [x,y][]
  info?: StatDisplayValue[]; // Legend info
  isVisible: boolean;
  useRightYAxis: boolean;
}
