/** The keys of a record keyed by a union, so a union member that is missing or extra fails the type check. */
export function keysOf<T extends string>(record: Record<T, true>): T[] {
  return Object.keys(record).filter((key): key is T => key in record);
}
