import { z } from 'zod';

/**
 * Strip `.default()` wrappers from every top-level field of an object schema
 * using Zod's public `ZodDefault.unwrap()` API. Composes cleanly with `.partial()`:
 * without this, `schema.partial()` makes fields optional but leaves the inner
 * `ZodDefault` in place, so omitted keys still get filled with the default
 * value -- which would clobber existing data on partial updates.
 *
 * Use case: building "partial update" payload schemas for UPDATE_* commands
 * where omitting a field must mean "leave the existing value alone".
 *
 * Only the outer wrapper is touched. Fields without `.default()` pass through
 * unchanged. Nested object fields are not recursed -- pass them through
 * `stripDefaults` separately if their inner defaults also need removing.
 */
export function stripDefaults<T extends z.ZodObject<z.ZodRawShape>>(schema: T): z.ZodObject<z.ZodRawShape> {
  const newShape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => [key, field instanceof z.ZodDefault ? field.unwrap() : field])
  );
  return z.object(newShape);
}
