import { DataFrame } from '../types/dataFrame';

/**
 * Returns true if both frames have the same list of fields and configs.
 * Each field can have diferent names, labels and values
 */
export function framesHaveSameStructure(a: DataFrame, b: DataFrame): boolean {
  if (a === b) {
    return true;
  }
  if (a?.fields?.length !== b?.fields?.length) {
    return false;
  }
  for (let i = 0; i < a.fields.length; i++) {
    const fA = a.fields[i];
    const fB = b.fields[i];
    if (fA.type !== fB.type) {
      return false;
    }
    const cfgA = fA.config as any;
    const cfgB = fB.config as any;

    const keys = Object.keys(cfgA);
    if (keys.length !== Object.keys(cfgB).length) {
      return false;
    }
    for (const key of keys) {
      if (!cfgB.hasOwnProperty(key)) {
        return false;
      }
      if (cfgA[key] !== cfgB[key]) {
        return false;
      }
    }
  }
  return true;
}

export function arrayCompare<T>(a: T[], b: T[], fn: (a: T, b: T) => boolean) {
  if (a === b) {
    return true;
  }
  if (a?.length !== b?.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (!fn(a[i], b[i])) {
      return false;
    }
  }
  return true;
}
