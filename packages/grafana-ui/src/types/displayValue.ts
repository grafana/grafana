import { DecimalCount } from '../utils';
import { ValueMapping } from './panel';
import { Threshold } from './threshold';
import { GrafanaTheme } from './theme';

export interface DisplayValue {
  text: string; // Show in the UI
  numeric: number; // Use isNaN to check if it is a real number
  color?: string; // color based on configs or Threshold
}

export interface DisplayValueOptions {
  unit?: string;
  decimals?: DecimalCount;
  dateFormat?: string; // If set try to convert numbers to date

  color?: string;
  mappings?: ValueMapping[];
  thresholds?: Threshold[];
  prefix?: string;
  suffix?: string;

  // Alternative to empty string
  noValue?: string;

  // Context
  isUtc?: boolean;
  theme?: GrafanaTheme; // Will pick 'dark' if not defined
}

export interface DecimalInfo {
  decimals: number;
  scaledDecimals: number;
}
