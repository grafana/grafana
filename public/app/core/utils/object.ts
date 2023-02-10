import { isArray, isPlainObject } from 'lodash';

/** @returns a deep clone of the object, but with any null value removed */
export function sortedDeepCloneWithoutJSONNulls<T extends {}>(value: T): T {
  if (isArray(value)) {
    return value.map(sortedDeepCloneWithoutJSONNulls) as unknown as T;
  }
  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((acc: any, key) => {
        const v = (value as any)[key];
        if (v != null && v !== -Infinity) {
          // -Infinity is encoded as null in json
          acc[key] = sortedDeepCloneWithoutJSONNulls(v);
        }
        return acc;
      }, {});
  }
  return value;
}
