/**
 * @internal
 * A bounded cache with O(1) inserts and no per-insert eviction scan. It keeps two generations:
 * writes go to `primary`; when `primary` fills, it becomes `secondary` (whatever was in the old
 * `secondary` is dropped) and a fresh `primary` starts. Reads check both generations and promote a
 * survivor back into `primary`, which approximates LRU. Total live entries stay within ~2x maxSize.
 */
export function createBoundedCache<K, V>(maxSize: number) {
  let primary = new Map<K, V>();
  let secondary = new Map<K, V>();

  // Every write to `primary` — whether a fresh `set` or a promotion from `secondary` in `get` — goes
  // through here so the rotation check runs on all growth paths. (Rotating only in `set` let `get`'s
  // promotions grow `primary` past `maxSize` between writes, breaking the ~2x bound.)
  const put = (key: K, value: V): void => {
    primary.set(key, value);
    if (primary.size >= maxSize) {
      secondary = primary;
      primary = new Map<K, V>();
    }
  };

  return {
    get(key: K): V | undefined {
      const fromPrimary = primary.get(key);
      if (fromPrimary !== undefined) {
        return fromPrimary;
      }
      const fromSecondary = secondary.get(key);
      if (fromSecondary !== undefined) {
        put(key, fromSecondary); // promote into the current generation, keeping the size bound
      }
      return fromSecondary;
    },
    set: put,
  };
}
