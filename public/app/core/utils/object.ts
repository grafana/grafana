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
        // Remove null values and also -Infinity which is not a valid JSON value
        if (v != null && v !== -Infinity) {
          acc[key] = sortedDeepCloneWithoutNulls(v);
        }
        return acc;
      }, {});
  }
  return value;
}
