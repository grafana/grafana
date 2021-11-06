import { isArray, isPlainObject } from 'lodash';

/** @returns a deep clone of the object, but with any null value removed */
export function sortedDeepCloneWithoutNulls<T>(value: T): T {
  if (isArray(value)) {
    return (value.map(sortedDeepCloneWithoutNulls) as unknown) as T;
  }
  return Object.keys(value)
    .sort()
    .reduce((acc: any, key) => {
      let v = (value as any)[key];
      if (v != null) {
        if (isPlainObject(v)) {
          v = sortedDeepCloneWithoutNulls(v);
        }
        acc[key] = v;
      }
      return acc;
    }, {});
}
