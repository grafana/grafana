export interface Threshold {
  /**
   * Step value. May be a string containing a variable expression (e.g. `$myVar`) in raw/persisted
   * configs; such strings are resolved to numbers during `applyFieldOverrides` (steps that don't
   * resolve to a finite number are dropped). Processed field configs contain only numbers.
   */
  value: number | string;
  color: string;
  /**
   *  Warning, Error, LowLow, Low, OK, High, HighHigh etc
   */
  state?: string;
}

/**
 *  Display mode
 */
export enum ThresholdsMode {
  Absolute = 'absolute',
  /**
   *  between 0 and 1 (based on min/max)
   */
  Percentage = 'percentage',
}

/**
 *  Config that is passed to the ThresholdsEditor
 */
export interface ThresholdsConfig {
  mode: ThresholdsMode;

  /**
   *  Must be sorted by 'value', first value is always -Infinity
   */
  steps: Threshold[];
}
