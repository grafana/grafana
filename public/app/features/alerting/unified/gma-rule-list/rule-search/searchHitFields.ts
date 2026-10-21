export function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/** Accepts only one of `values`, compared exactly, so an unknown value reads as absent. */
export function asOneOf<T extends string>(value: unknown, values: readonly T[]): T | undefined {
  return values.find((candidate) => candidate === value);
}

/** The keys of a record keyed by a union, so a union member that is missing or extra fails the type check. */
export function keysOf<T extends string>(record: Record<T, true>): T[] {
  return Object.keys(record).filter((key): key is T => key in record);
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Labels are indexed and returned as `key=value` strings, not an object. */
export function asLabels(value: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of asStringArray(value)) {
    const separatorIndex = entry.indexOf('=');
    if (separatorIndex === -1) {
      result[entry] = '';
    } else {
      result[entry.slice(0, separatorIndex)] = entry.slice(separatorIndex + 1);
    }
  }
  return result;
}
