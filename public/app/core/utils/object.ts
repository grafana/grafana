import { isArray, isPlainObject } from 'lodash';

/**
 * @returns A deep clone of the object, but with any null value removed.
 * @param value - The object to be cloned and cleaned.
 * @param convertInfinity - If true, -Infinity or Infinity is converted to 0.
 * This is because Infinity is not a valid JSON value, and sometimes we want to convert it to 0 instead of default null.
 */
export function sortedDeepCloneWithoutNulls<T>(value: T, convertInfinity?: boolean): T {
  if (isArray(value)) {
    return value.map((item) => sortedDeepCloneWithoutNulls(item, convertInfinity)) as unknown as T;
  }
  if (isPlainObject(value)) {
    return Object.keys(value as { [key: string]: any })
      .sort()
      .reduce((acc: any, key) => {
        const v = (value as any)[key];
        // Remove null values
        if (v != null) {
          acc[key] = sortedDeepCloneWithoutNulls(v, convertInfinity);
        }

        if (convertInfinity && (v === Infinity || v === -Infinity)) {
          acc[key] = 0;
        }

        return acc;
      }, {});
  }
  return value;
}
