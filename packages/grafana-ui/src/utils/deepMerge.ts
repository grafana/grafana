/**
 * Deep merges multiple source objects into a target object, mutating the target.
 * Arrays are replaced rather than merged by index.
 * This intentionally differs from lodash.merge, which merges arrays by index.
 */
export function deepMerge<T extends object>(target: T, ...sources: Array<Partial<T> | undefined>): T {
  for (const source of sources) {
    if (source == null) {
      continue;
    }
    const src = source as Record<PropertyKey, unknown>; // eslint-disable-line @typescript-eslint/consistent-type-assertions
    const tgt = target as Record<PropertyKey, unknown>; // eslint-disable-line @typescript-eslint/consistent-type-assertions

    for (const key of Object.keys(src)) {
      const srcVal = src[key];
      const tgtVal = tgt[key];

      if (isPlainObject(srcVal) && isPlainObject(tgtVal)) {
        deepMerge(tgtVal, srcVal);
      } else if (srcVal !== undefined) {
        tgt[key] = srcVal;
      }
    }
  }
  return target;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
