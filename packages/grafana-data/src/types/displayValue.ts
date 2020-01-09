import { FormattedValue } from '../valueFormats';

export type DisplayProcessor = (value: any) => DisplayValue;

export interface DisplayValue extends FormattedValue {
  numeric: number; // Use isNaN to check if it is a real number
  percent?: number; // 0-1 between min & max
  color?: string; // color based on configs or Threshold
  title?: string;
}

/**
 * These represents the display value with the longest title and text.
 * Used to align widths and heights when displaying multiple DisplayValues
 */
export interface DisplayValueAlignmentFactors extends FormattedValue {
  title: string;
}

export type DecimalCount = number | null | undefined;

export interface DecimalInfo {
  decimals: DecimalCount;
  scaledDecimals: DecimalCount;
}
