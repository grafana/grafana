const SCIENTIFIC_NOTATION_THRESHOLD_SMALL = 1e-2;
const SCIENTIFIC_NOTATION_THRESHOLD_LARGE = 1e4;
const MAX_DECIMAL_PLACES = 4;
const EXPONENTIAL_DECIMALS = 3; // 4 significant digits = 1 digit + 3 decimals

const readableRangeFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: MAX_DECIMAL_PLACES,
  useGrouping: false,
});

/**
 * Counts the number of decimal places in a number.
 * Only processes numbers in readable range (1e-2 to 1e4) to avoid
 * toString() scientific notation issues for very large/small numbers.
 *
 * Uses toFixed(10) to ensure standard notation representation.
 * 10 decimal places is sufficient to detect if a number has > 4 decimal places.
 */
function countDecimalPlaces(value: number): number {
  if (Number.isInteger(value)) {
    return 0;
  }

  const absValue = Math.abs(value);

  // Only count decimals for numbers in readable range
  if (absValue < SCIENTIFIC_NOTATION_THRESHOLD_SMALL || absValue > SCIENTIFIC_NOTATION_THRESHOLD_LARGE) {
    return 0;
  }

  const str = value.toFixed(10);
  const decimalIndex = str.indexOf('.');

  if (decimalIndex === -1) {
    return 0;
  }

  // Count decimal places, removing trailing zeros
  const decimalPart = str.substring(decimalIndex + 1).replace(/0+$/, '');
  return decimalPart.length;
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
  if (!Number.isFinite(value)) {
    return String(value);
  }

  if (value === 0) {
    return '0';
  }

  const absValue = Math.abs(value);

  if (absValue < SCIENTIFIC_NOTATION_THRESHOLD_SMALL || absValue > SCIENTIFIC_NOTATION_THRESHOLD_LARGE) {
    return value.toExponential(EXPONENTIAL_DECIMALS);
  }

  const decimalPlaces = countDecimalPlaces(value);

  if (decimalPlaces > MAX_DECIMAL_PLACES) {
    return value.toExponential(EXPONENTIAL_DECIMALS);
  }

  return readableRangeFormatter.format(value);
}
