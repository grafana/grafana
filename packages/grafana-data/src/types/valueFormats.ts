import { type DecimalCount } from './displayValue';
import { type TimeZone } from './time';

export interface FormattedValue {
  text: string;
  prefix?: string;
  suffix?: string;
}

export type ValueFormatter = (
  value: number,
  decimals?: DecimalCount,
  scaledDecimals?: DecimalCount,
  timeZone?: TimeZone,
  showMs?: boolean
) => FormattedValue;

export interface ValueFormat {
  name: string;
  id: string;
  fn: ValueFormatter;
}

export interface ValueFormatCategory {
  name: string;
  formats: ValueFormat[];
}

export interface ValueFormatterIndex {
  [id: string]: ValueFormatter;
}
