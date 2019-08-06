export interface DisplayValue {
  text: string; // Show in the UI
  numeric: number; // Use isNaN to check if it is a real number
  color?: string; // color based on configs or Threshold
  title?: string;
  fontSize?: string;
}

export type DecimalCount = number | null | undefined;

export interface DecimalInfo {
  decimals: DecimalCount;
  scaledDecimals: DecimalCount;
}
