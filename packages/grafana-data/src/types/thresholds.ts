export interface Threshold {
  value: number;
  color: string;
  /**
   *  Optional dashboard-variable expression (e.g. `$myVar`) resolved during
   *  `applyFieldOverrides`; the numeric `value` is the fallback used when the
   *  expression cannot be resolved to a single finite number. Resolved
   *  (runtime) configs never carry this property.
   */
  valueExpr?: string;
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
