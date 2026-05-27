/**
 * Utilities for parsing intent field text into numeric values for
 * chip status coloring (Phase E.5).
 *
 * Design constraints:
 * - Best-effort; undefined is the safe fallback for unrecognised text.
 * - No unit conversion: if intent says "500ms" we extract 500; the
 *   author is expected to match the panel's data units.
 */

/**
 * Extract the first decimal number from an alert-threshold expression.
 *
 * Examples:
 *   "p99 > 500ms for 5m"  → 500
 *   "error rate > 5%"     → 5
 *   "memory > 2GB"        → 2
 *   "spike"               → undefined
 *   ""                    → undefined
 */
export function parseAlertThreshold(text: string | undefined): number | undefined {
  if (!text?.trim()) {
    return undefined;
  }
  // Prefer the value after a comparison operator ("> 500ms", ">= 5%", "< 2GB")
  // so we extract the threshold, not an identifier like the "99" in "p99".
  const comparatorMatch = /[><=]+\s*(\d+(?:\.\d+)?)/.exec(text);
  if (comparatorMatch) {
    const n = parseFloat(comparatorMatch[1]);
    return Number.isFinite(n) ? n : undefined;
  }
  // Fall back to the first number not immediately preceded by a letter.
  // This skips quantile/percentile identifiers (p99, q95) while still
  // matching bare values like "500ms" or "1000".
  const match = /(?<![a-zA-Z])(\d+(?:\.\d+)?)/.exec(text);
  if (!match) {
    return undefined;
  }
  const n = parseFloat(match[1]);
  return Number.isFinite(n) ? Number(n) : undefined;
}

/**
 * Extract a numeric [min, max] range from a range expression.
 * Returns undefined when the text is not a recognisable range.
 *
 * Examples:
 *   "10–20 logins/min"  → { min: 10, max: 20 }
 *   "100-200ms"         → { min: 100, max: 200 }
 *   "50 to 80"          → { min: 50, max: 80 }
 *   "p99 < 250ms"       → undefined  (single value, use alertThreshold)
 *   ""                  → undefined
 */
export function parseNormalRange(text: string | undefined): { min: number; max: number } | undefined {
  if (!text?.trim()) {
    return undefined;
  }
  // Match "N–M", "N-M", "N—M" (en-dash, hyphen, em-dash)
  const dashMatch = /(\d+(?:\.\d+)?)\s*[–\-—]\s*(\d+(?:\.\d+)?)/.exec(text);
  // Match "N to M" (case-insensitive)
  const toMatch = /(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)/i.exec(text);

  const m = dashMatch ?? toMatch;
  if (!m) {
    return undefined;
  }
  const min = parseFloat(m[1]);
  const max = parseFloat(m[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    return undefined;
  }
  return { min, max };
}

/**
 * Returns true when the threshold expression uses a less-than operator
 * ("< 200ms", "<= 5"). Defaults to false (greater-than) when the
 * operator is absent or unrecognised.
 */
export function isLessThanThreshold(text: string | undefined): boolean {
  return /^\s*</.test(text ?? '');
}
