import * as z from 'zod';

// Search fields are untyped in the API. Each schema reads a field that is missing or fails its check
// as absent, so one bad field never fails the whole hit.

export const optionalString = z.string().optional().catch(undefined);

export const optionalBoolean = z.boolean().optional().catch(undefined);

export const optionalCount = z.number().optional().catch(undefined);

export const stringArray = z
  .array(z.unknown())
  .transform((values) => values.filter((value) => typeof value === 'string'))
  .catch([]);

/** Labels are indexed and returned as `key=value` strings, not an object. */
export const labels = z
  .array(z.unknown())
  .transform((entries) => {
    const result: Record<string, string> = {};
    for (const entry of entries) {
      if (typeof entry !== 'string') {
        continue;
      }
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex === -1) {
        result[entry] = '';
      } else {
        result[entry.slice(0, separatorIndex)] = entry.slice(separatorIndex + 1);
      }
    }
    return result;
  })
  .catch({});
