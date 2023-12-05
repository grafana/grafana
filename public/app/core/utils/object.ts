import { isArray, isPlainObject } from 'lodash';

/** @returns a deep clone of the object, but with any null value removed */
export function sortedDeepCloneWithoutNulls<T extends {}>(value: T): T {
  if (isArray(value)) {
    return value.map(sortedDeepCloneWithoutNulls) as unknown as T;
  }
  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((acc: any, key) => {
        const v = (value as any)[key];
        if (v != null) {
          acc[key] = sortedDeepCloneWithoutNulls(v);
        }
        return acc;
      }, {});
  }
  return value;
}

export function getCircularReplacer() {
  const ancestors = [];

  return function (key, value) {
    if (typeof value !== 'object' || value === null) {
      return value;
    }
    // `this` is the object that value is contained in,
    // i.e., its direct parent.
    while (ancestors.length > 0 && ancestors.at(-1) !== this) {
      ancestors.pop();
    }
    if (ancestors.includes(value)) {
      return '[Circular]';
    }
    ancestors.push(value);
    return value;
  };
}
