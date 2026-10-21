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
