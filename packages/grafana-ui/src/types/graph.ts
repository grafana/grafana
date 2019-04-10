import { DisplayValue } from './displayValue';
import { ColumnStats } from '../utils/statsCalculator';

export type GraphSeriesValue = number | null;

/** View model projection of a series */
export interface GraphSeriesXY {
  label: string;
  color: string;
  data: GraphSeriesValue[][]; // [x,y][]
  info?: DisplayValue[]; // Legend info
  stats: ColumnStats;
  isVisible: boolean;
  useRightYAxis: boolean;
}
