import { isArray, isPlainObject, isString } from 'lodash';

/**
 * @returns A deep clone of the object, but with any null value removed.
 * @param value - The object to be cloned and cleaned.
 * @param convertInfinity - If true, -Infinity or Infinity is converted to 0.
 * This is because Infinity is not a valid JSON value, and sometimes we want to convert it to 0 instead of default null.
 * @param stripBOMs - If true, strips Byte Order Mark (BOM) characters from all strings.
 * BOMs (U+FEFF) can cause CUE validation errors ("illegal byte order mark").
 */
export function sortedDeepCloneWithoutNulls<T>(value: T, convertInfinity?: boolean, stripBOMs?: boolean): T {
  if (isArray(value)) {
    return value.map((item) => sortedDeepCloneWithoutNulls(item, convertInfinity, stripBOMs)) as unknown as T;
  }
  if (isPlainObject(value)) {
    return Object.keys(value as { [key: string]: any })
      .sort()
      .reduce((acc: any, key) => {
        let v = (value as any)[key];
        // Remove null values
        if (v != null) {
          // Strip BOMs from strings
          if (stripBOMs && isString(v)) {
            v = v.replace(/\ufeff/g, '');
          }
          acc[key] = sortedDeepCloneWithoutNulls(v, convertInfinity, stripBOMs);
        }

        if (convertInfinity && (v === Infinity || v === -Infinity)) {
          acc[key] = 0;
        }

        return acc;
      }, {});
  }
  return value;
}
