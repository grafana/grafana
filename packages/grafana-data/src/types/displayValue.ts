import { type FormattedValue } from './valueFormats';

/**
 * Batch color resolution: a deduped palette and a per-value index into it (parallel to the input).
 *
 * @alpha
 */
export interface DisplayColors {
  palette: string[];
  indices: number[];
}

export interface DisplayProcessor {
  (value: unknown, decimals?: DecimalCount): DisplayValue;
  /**
   * Resolve only the color of a value, skipping the (expensive) text/number
   * formatting. Equivalent to `display(value).color`. Optional because not every
   * DisplayProcessor (e.g. plain inline ones) provides it — fall back to
   * `display(value).color` when absent.
   *
   * @alpha
   */
  color?(value: unknown): string | undefined;
  /**
   * Resolve only the formatted text of a value. Equivalent to `display(value).text`.
   *
   * @alpha
   */
  text?(value: unknown, decimals?: DecimalCount): string;
  /**
   * Resolve colors for many values at once, returning a deduped palette plus a
   * per-value index into it. For large value sets (e.g. scatter point clouds).
   *
   * @alpha
   */
  colors?(values: unknown[], min?: number, max?: number): DisplayColors;
}

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
   *  0-1 percent change across range
   */
  percentChange?: number;
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
