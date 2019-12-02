export type DisplayProcessor = (value: any) => DisplayValue;

export interface DisplayValue {
  text: string; // Show in the UI
  numeric: number; // Use isNaN to check if it is a real number
  color?: string; // color based on configs or Threshold
  title?: string;
  fontSize?: string;
}

/**
 * These represents the displau value with the longest title and text.
 * Used to align widths and heights when displaying multiple DisplayValues
 */
export interface DisplayValueAlignmentFactors {
  title: string;
  text: string;
}

export type DecimalCount = number | null | undefined;

export interface DecimalInfo {
  decimals: DecimalCount;
  scaledDecimals: DecimalCount;
}
