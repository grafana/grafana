/**
 * Type guard to check if a value is a non-null object (record).
 * Explicitly excludes arrays to avoid unexpected traversal behavior.
 * Useful for safely accessing properties on unknown values.
 */
export function isRecord(value: unknown): value is Record<string | number | symbol, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
