// Copyright (c) 2014, Hugh Kennedy
// Based on code from https://github.com/hughsk/flat/blob/master/index.js
//
export default function flatten(
  target: object,
  opts?: { delimiter?: string; maxDepth?: number; safe?: boolean }
): Record<string, unknown> {
  opts = opts || {};

  const delimiter = opts.delimiter || '.';
  let maxDepth = opts.maxDepth || 3;
  let currentDepth = 1;
  const output: Record<string, unknown> = {};

  function step(object: any, prev: string | null) {
    Object.keys(object).forEach((key) => {
      const value = object[key];
      const isarray = opts?.safe && Array.isArray(value);
      const type = Object.prototype.toString.call(value);
      const isobject = type === '[object Object]';

      const newKey = prev ? prev + delimiter + key : key;

      if (!opts?.maxDepth) {
        maxDepth = currentDepth + 1;
      }

      if (!isarray && isobject && Object.keys(value).length && currentDepth < maxDepth) {
        ++currentDepth;
        return step(value, newKey);
      }

      output[newKey] = value;
    });
  }

  step(target, null);

  return output;
}
