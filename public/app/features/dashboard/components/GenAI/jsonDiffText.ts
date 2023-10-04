import { createTwoFilesPatch } from 'diff';

import { Dashboard } from '@grafana/schema';

import { DashboardModel } from '../../state';

export type JSONValue = null | boolean | number | string | JSONArray | JSONObject;

export type JSONArray = JSONValue[];

export type JSONObject = {
  [key: string]: JSONValue;
};

export function orderProperties(obj1: JSONValue, obj2: JSONValue) {
  // If obj1 and obj2 are the same object, return obj2
  if (obj1 === obj2) {
    return obj2; // No need to order properties, they are already the same
  }

  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    // They are both arrays
    return orderArrayProperties(obj1, obj2);
  }

  // Use a type guard to check if they are both non-array objects
  else if (isObject(obj1) && isObject(obj2)) {
    // Both non-array objects
    return orderObjectProperties(obj1, obj2);
  }

  return obj2;
}

export function isObject(obj: JSONValue): obj is JSONObject {
  return typeof obj === 'object' && !Array.isArray(obj) && obj !== null;
}

export function orderObjectProperties(obj1: JSONObject, obj2: JSONObject) {
  const orderedProperties = Object.keys(obj1);
  const orderedObj2: Record<string, JSONValue> = {};

  for (const prop of orderedProperties) {
    if (obj2.hasOwnProperty(prop)) {
      if (Array.isArray(obj1[prop]) && Array.isArray(obj2[prop])) {
        // Recursive call orderProperties for arrays
        orderedObj2[prop] = orderProperties(obj1[prop], obj2[prop]);
      } else if (typeof obj1[prop] === 'object' && typeof obj2[prop] === 'object') {
        // Recursively call orderProperties for nested objects
        orderedObj2[prop] = orderProperties(obj1[prop], obj2[prop]);
      } else {
        orderedObj2[prop] = obj2[prop];
      }
    }
  }
  return orderedObj2;
}

export function orderArrayProperties(obj1: JSONArray, obj2: JSONArray) {
  const orderedObj2: JSONValue[] = new Array(obj1.length).fill(undefined);

  const unseen1 = new Set<number>([...Array(obj1.length).keys()]);
  const unseen2 = new Set<number>([...Array(obj2.length).keys()]);

  // Loop to match up elements that match exactly
  for (let i = 0; i < obj1.length; i++) {
    if (unseen2.size === 0) {
      break;
    }
    let item1 = obj1[i];
    for (let j = 0; j < obj2.length; j++) {
      if (!unseen2.has(j)) {
        continue;
      }
      let item2 = obj2[j];
      item2 = orderProperties(item1, item2);
      if (JSON.stringify(item1) === JSON.stringify(item2)) {
        unseen1.delete(i);
        unseen2.delete(j);
        orderedObj2[i] = item2;
      }
    }
  }

  fillBySimilarity(obj1, obj2, orderedObj2, unseen1, unseen2);

  return orderedObj2.filter((value) => value !== undefined);
}

// Compare all pairings by similarity and match greedily from highest to lowest
// Similarity is simply measured by number of k:v pairs in fair
// O(n^2), which is more or less unavoidable
// Can be made a better match by using levenshtein distance and Hungarian matching
export function fillBySimilarity(
  // TODO: Investigate not using any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj1: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj2: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orderedObj2: any[],
  unseen1: Set<number>,
  unseen2: Set<number>
): void {
  let rankings: Record<number, number[][]> = {}; // Maps scores to arrays of value pairs
  // Unpacking it because I'm not sure removing items while iterating is safe

  unseen2.forEach((j: number) => {
    // Index name matches calling function
    let item2 = obj2[j];

    // If not object, or if array, just push item2 to orderedObj2 and remove j from unseen2
    if (typeof item2 !== 'object' || Array.isArray(item2)) {
      orderedObj2.push(item2);
      unseen2.delete(j);
      return;
    }

    unseen1.forEach((i: number) => {
      let item1 = obj1[i];
      if (typeof item1 !== 'object' || Array.isArray(item1)) {
        unseen1.delete(i);
        return;
      }

      let score = 0;

      for (const key in item1) {
        let val1 = item1[key];
        if (!item2.hasOwnProperty(key)) {
          continue;
        }
        let val2 = item2[key];
        if ((typeof val1 !== 'string' && typeof val1 !== 'number') || typeof val1 !== typeof val2) {
          continue;
        }
        if (val1 === val2) {
          score++;
        }
      }

      if (score !== 0) {
        if (rankings[score] === undefined) {
          rankings[score] = [];
        }
        rankings[score].push([i, j]);
      }
    });
  });

  const keys: number[] = Object.keys(rankings).map(Number); // Get keys as an array of numbers
  keys.sort((a, b) => b - a); // Sort in descending order

  for (const key of keys) {
    let pairs: number[][] = rankings[key];
    for (const pair of pairs) {
      const [i, j] = pair;
      if (unseen1.has(i) && unseen2.has(j)) {
        orderedObj2[i] = obj2[j];
        unseen1.delete(i);
        unseen2.delete(j);
      }
    }
  }

  // Get anything that had no matches whatsoever
  for (const j of unseen2) {
    orderedObj2.push(obj2[j]);
  }
}

export function jsonSanitize(obj: Dashboard | DashboardModel | null) {
  return JSON.parse(JSON.stringify(obj, null, 2));
}

export function getDashboardStringDiff(dashboard: DashboardModel) {
  const originalDashboard = jsonSanitize(dashboard.getOriginalDashboard());
  let dashboardAfterMigration = jsonSanitize(new DashboardModel(originalDashboard).getSaveModelClone());
  let currentDashboard = jsonSanitize(dashboard.getSaveModelClone());

  dashboardAfterMigration = orderProperties(originalDashboard, dashboardAfterMigration);
  currentDashboard = orderProperties(dashboardAfterMigration, currentDashboard);

  let migrationDiff = createTwoFilesPatch(
    originalDashboard.title ?? 'Before migration changes',
    dashboardAfterMigration.title ?? 'After migration changes',
    JSON.stringify(originalDashboard, null, 2),
    JSON.stringify(dashboardAfterMigration, null, 2),
    '',
    '',
    { context: 5 }
  );

  let userDiff = createTwoFilesPatch(
    dashboardAfterMigration.title ?? 'Before user changes',
    currentDashboard.title ?? 'After user changes',
    JSON.stringify(dashboardAfterMigration, null, 2),
    JSON.stringify(currentDashboard, null, 2),
    '',
    '',
    { context: 5 }
  );

  return { migrationDiff, userDiff };
}
