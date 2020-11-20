import { DataFrame } from '../types/dataFrame';

/**
 * Returns true if both frames have the same list of fields and configs.
 * Field may have diferent names, labels and values but share the same structure
 *
 * To compare multiple frames use:
 * ```
 * areArraysEqual(a, b, framesHaveSameStructure);
 * ```
 * NOTE: this does a shallow check on the FieldConfig properties, when using the query
 * editor, this should be sufficient, however if applicaitons are mutating properties
 * deep in the FieldConfig this will not recognize a change
 *
 * @beta
 */
export function compareDataFrameStructures(a: DataFrame, b: DataFrame): boolean {
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

/**
 * Check if all values in two arrays match the compare funciton
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
