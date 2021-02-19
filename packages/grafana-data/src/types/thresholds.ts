export interface Threshold {
  value: number;
  color: string;
  state?: string; // Warning, Error, LowLow, Low, OK, High, HighHigh etc
}

export enum ThresholdsMode {
  Absolute = 'absolute',
  Percentage = 'percentage', // between 0 and 1 (based on min/max)
}

export interface ThresholdsConfig {
  mode: ThresholdsMode;

  // Must be sorted by 'value', first value is always -Infinity
  steps: Threshold[];
}
