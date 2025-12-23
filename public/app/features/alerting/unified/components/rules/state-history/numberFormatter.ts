const NOTATION_THRESHOLD_SMALL = 1e-2;
const NOTATION_THRESHOLD_LARGE = 1e4;
const MAX_DECIMAL_PLACES = 4;
const EXPONENTIAL_DECIMALS = 3;

// Create formatter once at module level (reused for all calls)
const readableRangeFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: MAX_DECIMAL_PLACES,
  useGrouping: false,
});

/**
 * Formats a numeric value for display in alert rule history.
 * - For values in human-readable range (1e-2 to 1e4): shows up to 4 decimal places
 * - For very small values (< 1e-2): uses scientific notation with 4 significant digits
 * - For very large values (> 1e4): uses scientific notation with 4 significant digits
 *
 * @param value - The number to format
 * @returns A formatted string representation of the number
 */
export function formatNumericValue(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }

  if (value === 0) {
    return '0';
  }

  const absValue = Math.abs(value);

  // Use scientific notation for very small or very large numbers
  if (absValue < NOTATION_THRESHOLD_SMALL || absValue > NOTATION_THRESHOLD_LARGE) {
    return value.toExponential(EXPONENTIAL_DECIMALS);
  }

  // For human-readable range, reuse the module-level formatter
  return readableRangeFormatter.format(value);
}
