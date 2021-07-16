import { Field } from '@grafana/data';

export interface BaseDimensionConfig<T = any> {
  fixed: T;
  field?: string;
}

export interface DimensionSupplier<T = any> {
  /**
   * This means an explicit value was not configured
   */
  isAssumed?: boolean;

  /**
   * The fied used for
   */
  field?: Field;

  /**
   * Explicit value -- if == null, then need a value pr index
   */
  fixed?: T;

  /**
   * Supplier for the dimension value
   */
  get: (index: number) => T;
}

/** This will map the field value% to a scaled value within the range */
export interface ScaleDimensionConfig extends BaseDimensionConfig<number> {
  min: number;
  max: number;
}

/** Places that use the value */
export interface ScaleDimensionOptions {
  min: number;
  max: number;
  step?: number;
  hideRange?: boolean; // false
}

/** Use the color value from field configs */
export interface ColorDimensionConfig extends BaseDimensionConfig<string> {}
