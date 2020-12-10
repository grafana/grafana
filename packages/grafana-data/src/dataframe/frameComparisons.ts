import { DataFrame } from '../types/dataFrame';

/**
 * Returns true if both frames have the same list of fields and configs.
 * Field may have diferent names, labels and values but share the same structure
 *
 * To compare multiple frames use:
 * ```
 * compareArrayValues(a, b, framesHaveSameStructure);
 * ```
 * NOTE: this does a shallow check on the FieldConfig properties, when using the query
 * editor, this should be sufficient, however if applicaitons are mutating properties
 * deep in the FieldConfig this will not recognize a change
 *
 * @beta
 */
export function compareDataFrameStructures(a: DataFrame, b: DataFrame, skipProperties?: string[]): boolean {
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

    let aKeys = Object.keys(cfgA);
    let bKeys = Object.keys(cfgB);

    if (skipProperties) {
      aKeys = aKeys.filter(k => skipProperties.indexOf(k) < 0);
      bKeys = aKeys.filter(k => skipProperties.indexOf(k) < 0);
    }
    if (aKeys.length !== bKeys.length) {
      return false;
    }

    for (const key of aKeys) {
      if (skipProperties && skipProperties.indexOf(key) > -1) {
        continue;
      }

      if (!cfgB.hasOwnProperty(key)) {
        return false;
      }

      if (key === 'custom') {
        if (!shallowCompare(cfgA[key], cfgB[key])) {
          return false;
        } else {
          continue;
        }
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

/**
 * Checks if two objects are equal shallowly
 *
 * @beta
 */
export function shallowCompare<T extends {}>(a: T, b: T, cmp?: (valA: any, valB: any) => boolean) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (a === b) {
    return true;
  }

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  for (let key of aKeys) {
    if (cmp) {
      //@ts-ignore
      return cmp(a[key], b[key]);
    }
    //@ts-ignore
    if (a[key] !== b[key]) {
      return false;
    }
  }

  return true;
}
