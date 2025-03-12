import { isArray, isPlainObject } from 'lodash';

/** @returns a deep clone of the object, but with any null value removed */
export function sortedDeepCloneWithoutNulls<T>(value: T): T {
  if (isArray(value)) {
    return value.map(sortedDeepCloneWithoutNulls) as unknown as T;
  }
  if (isPlainObject(value)) {
    return Object.keys(value as { [key: string]: any })
      .sort()
      .reduce((acc: any, key) => {
        const v = (value as any)[key];
        // Remove null values and convert -Infinity to 0 because -Infinity is not a valid JSON value
        if (v != null) {
          acc[key] = v === -Infinity ? 0 : sortedDeepCloneWithoutNulls(v);
        }
        return acc;
      }, {});
  }
  return value;
}
