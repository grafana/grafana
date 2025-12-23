const NOTATION_THRESHOLD_SMALL = 1e-2;
const NOTATION_THRESHOLD_LARGE = 1e4;
const MAX_DECIMAL_PLACES = 4;
const EXPONENTIAL_DECIMALS = 3; // 4 significant digits = 1 digit + 3 decimals

// Create formatter once at module level (reused for all calls)
const readableRangeFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: MAX_DECIMAL_PLACES,
  useGrouping: false,
});

/**
 * Counts the number of decimal places in a number.
 */
function countDecimalPlaces(value: number): number {
  if (Number.isInteger(value)) {
    return 0;
  }

  // Convert to string and find decimal point
  const str = value.toString();
  const decimalIndex = str.indexOf('.');

  if (decimalIndex === -1) {
    return 0;
  }

  // Return count of digits after decimal point
  return str.length - decimalIndex - 1;
}

/**
 * Formats a numeric value for display in alert rule history.
 * - For values in human-readable range (1e-2 to 1e4) with ≤ 4 decimal places: shows up to 4 decimal places
 * - For very small values (< 1e-2): uses scientific notation with 4 significant digits
 * - For very large values (> 1e4): uses scientific notation with 4 significant digits
 * - For numbers with > 4 decimal places: uses scientific notation with 4 significant digits
 *
 * @param value - The number to format
 * @returns A formatted string representation of the number
 */
export function formatNumericValue(value: number): string {
  // Handle special cases
  if (!Number.isFinite(value)) {
    return String(value); // NaN, Infinity
  }

  if (value === 0) {
    return '0';
  }

  const absValue = Math.abs(value);
  const decimalPlaces = countDecimalPlaces(value);

  // Use scientific notation for:
  // 1. Very small or very large numbers (magnitude-based)
  // 2. OR numbers with excessive decimal precision (> 4 decimals)
  if (
    absValue < NOTATION_THRESHOLD_SMALL ||
    absValue > NOTATION_THRESHOLD_LARGE ||
    decimalPlaces > MAX_DECIMAL_PLACES
  ) {
    return value.toExponential(EXPONENTIAL_DECIMALS);
  }

  // For human-readable range with ≤ 4 decimal places, use standard notation
  return readableRangeFormatter.format(value);
}
