/**
 * Describes a empty value matcher option.
 * @public
 */
export interface ValueMatcherOptions {}

/**
 * Describes a basic value matcher option that has a single value.
 * @public
 */
export interface BasicValueMatcherOptions<T = any> extends ValueMatcherOptions {
  value: T;
}

/**
 * Describes a range value matcher option that has a to and a from value to
 * be able to match a range.
 * @public
 */
export interface RangeValueMatcherOptions<T = any> extends ValueMatcherOptions {
  from?: T;
  to?: T;
  inclusive?: boolean;
  /** Missing bounds remain non-matching unless explicitly allowed. */
  allowOpenBounds?: boolean;
  /**
   * When set, only finite numbers are compared; all other values match this boolean.
   * Leave unset to preserve legacy numeric coercion.
   */
  includeMissing?: boolean;
}
