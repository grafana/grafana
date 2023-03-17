import { FormattedValue } from '../valueFormats';

import { FieldType } from './dataFrame';

export type DisplayProcessor = (value: any, decimals?: DecimalCount) => DisplayValue;

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
   *  FieldType for use when adding custom prefixes/suffixes to specific types of values
   */
  valueType?: FieldType;
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
  title: string;
}

export type DecimalCount = number | null | undefined;

export interface DecimalInfo {
  decimals: DecimalCount;
  scaledDecimals: DecimalCount;
}
