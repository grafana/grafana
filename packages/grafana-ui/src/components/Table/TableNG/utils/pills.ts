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

// inferPills lives here rather than in PillCell.tsx to avoid a circular dependency:
// styles.ts → utils.tsx → renderers.tsx → PillCell.tsx → styles.ts
/* ---------------------------- Pill inference ----------------------------- */
const SPLIT_RE = /\s*,\s*/;

function inferPillsImpl(rawValue: unknown): unknown[] {
  if (rawValue === '' || rawValue == null) {
    return [];
  }

  if (Array.isArray(rawValue)) {
    return rawValue.filter((v) => v != null).map((v) => String(v).trim());
  }

  const value = String(rawValue);

  if (value[0] === '[') {
    try {
      return JSON.parse(value);
    } catch {
      return value.trim().split(SPLIT_RE);
    }
  }

  return value.trim().split(SPLIT_RE);
}

// inferPills is pure and its inputs are stable across resizes, so we cache results. Array/object
// values are cached by reference in a WeakMap (unbounded-safe, auto-GC'd). Primitive (string) values
// persist for the whole app lifetime across every table, so they use a generational bounded cache
// (see createBoundedCache) sized generously enough that a large table mostly hits.
const arrayPillCache = new WeakMap<object, unknown[]>();
const primitivePillCache = createBoundedCache<string, unknown[]>(15000);

// Accepts an arbitrary raw cell value: pill columns hold string arrays (not in TableCellValue), and
// values can be null, so this is deliberately typed `unknown` and narrowed at runtime.
export function inferPills(rawValue: unknown): unknown[] {
  if (rawValue == null || rawValue === '') {
    return [];
  }

  if (typeof rawValue === 'object') {
    let cached = arrayPillCache.get(rawValue);
    if (cached === undefined) {
      cached = inferPillsImpl(rawValue);
      arrayPillCache.set(rawValue, cached);
    }
    return cached;
  }

  const key = String(rawValue);
  let cached = primitivePillCache.get(key);
  if (cached === undefined) {
    cached = inferPillsImpl(rawValue);
    primitivePillCache.set(key, cached);
  }
  return cached;
}

// Pill geometry, shared by the pill height measurer in ./height and the pill column width measurer
// in ./width.
export const PILLS_FONT_SIZE = 12;
export const PILLS_SPACING = 12; // 6px horizontal padding on each side
export const PILLS_GAP = 4; // gap between pills
