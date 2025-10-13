import { isEqual } from 'lodash';

import { DataFrame } from '../types/dataFrame';

/**
 * Returns true if both frames have the same name, fields, labels and configs.
 *
 * @example
 * To compare multiple frames use:
 * ```
 * compareArrayValues(a, b, framesHaveSameStructure);
 * ```
 * @beta
 */
export function compareDataFrameStructures(a: DataFrame, b: DataFrame, skipConfig?: boolean): boolean {
  if (a === b) {
    return true;
  }

  if (a?.fields?.length !== b?.fields?.length) {
    return false;
  }

  if (a.name !== b.name) {
    return false;
  }

  for (let i = 0; i < a.fields.length; i++) {
    const fA = a.fields[i];
    const fB = b.fields[i];

    if (fA.type !== fB.type || fA.name !== fB.name) {
      return false;
    }

    // Do not check the config fields
    if (skipConfig) {
      continue;
    }

    // Check if labels are different
    if (fA.labels && fB.labels && !shallowCompare(fA.labels, fB.labels)) {
      return false;
    }

    const cfgA = fA.config;
    const cfgB = fB.config;

    if (Object.keys(cfgA).length !== Object.keys(cfgB).length) {
      return false;
    }

    let key: keyof typeof cfgA;
    for (key in cfgA) {
      if (!(key in cfgB)) {
        return false;
      }

      if (key === 'interval') {
        continue;
      }

      // Deep comparison on all object properties
      if (!isEqual(cfgA[key], cfgB[key])) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if all values in two arrays match the compare function
 *
 * @beta
 */
export function compareArrayValues<T>(a: T[], b: T[], cmp: (a: T, b: T) => boolean) {
  if (a === b) {
    return true;
  }
  if (a?.length !== b?.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (!cmp(a[i], b[i])) {
      return false;
    }
  }
  return true;
}

type Cmp = (valA: unknown, valB: unknown) => boolean;

const defaultCmp: Cmp = (a, b) => a === b;

/**
 * Checks if two objects are equal shallowly
 *
 * @beta
 */
export function shallowCompare<T extends {}>(a: T, b: T, cmp: Cmp = defaultCmp) {
  if (a === b) {
    return true;
  }

  if (Object.keys(a).length !== Object.keys(b).length) {
    return false;
  }

  let key: keyof typeof a;
  for (key in a) {
    if (!cmp(a[key], b[key])) {
      return false;
    }
  }

  return true;
}
