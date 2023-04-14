import { FormattedValue } from '../valueFormats';

export type DisplayProcessor = (value: unknown, decimals?: DecimalCount) => DisplayValue;

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
   *  Color based on mappings or threshold
   */
  color?: string;
  /**
   *  Icon based on mappings or threshold
   */
  icon?: string;
  title?: string;

  /**
   * Used in limited scenarios like legend reducer calculations
   */
  description?: string;
}

/**
 * These represents the display value with the longest title and text.
 * Used to align widths and heights when displaying multiple DisplayValues
 */
export interface DisplayValueAlignmentFactors extends FormattedValue {
  title?: string;
}

export type DecimalCount = number | null | undefined;

export interface DecimalInfo {
  decimals: DecimalCount;
  scaledDecimals: DecimalCount;
}
