/**
 * Type guard to check if a value is a non-null object (record).
 * Useful for safely accessing properties on unknown values.
 */
export function isRecord(value: unknown): value is Record<string | number | symbol, unknown> {
  return typeof value === 'object' && value !== null;
}
