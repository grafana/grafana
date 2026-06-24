import { type SceneObject } from '@grafana/scenes';

// groups objects into named buckets
// items whose getPartitionKey callback returns null are excluded
export function partitionSceneObjects<T extends SceneObject>(
  objects: T[],
  getPartitionKey: (v: T) => string | null
): Partial<Record<string, T[]>> {
  const result: Partial<Record<string, T[]>> = {};

  for (const o of objects) {
    const key = getPartitionKey(o);
    if (key !== null) {
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(o);
    }
  }

  return result;
}
