import type { z } from 'zod';

/**
 * Parses a JSON string and validates it with a Zod schema.
 * Returns the parsed data if valid, otherwise returns the fallback value.
 *
 * @param raw - The JSON string to parse, or null/empty
 * @param schema - Zod schema to validate the parsed data
 * @param fallback - Value to return when parsing fails or input is null/empty
 * @returns Parsed and validated data, or fallback
 */
export function parseJsonWithSchema<T>(raw: string | null, schema: z.ZodType<T>, fallback: T): T {
  if (raw == null || raw === '') {
    return fallback;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : fallback;
  } catch {
    return fallback;
  }
}
