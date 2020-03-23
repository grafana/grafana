import { FormattedValue } from '../valueFormats';

export type DisplayProcessor = (value: any) => DisplayValue;

export interface DisplayValue extends FormattedValue {
  /**
   *  Use isNaN to check if it is a real number
   */
  numeric: number;
  /**
   *  0-1 between min & max
   */
  percent?: number;
  /**
   *  Color based on configs or Threshold
   */
  color?: string;
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
