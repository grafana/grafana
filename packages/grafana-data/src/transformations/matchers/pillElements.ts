/**
 * Shared pill elements for table rendering and value filtering.
 *
 * TableNG renders pill cells from raw values (inferPills) and value filtering
 * expands the same values into matchable elements (splitFilterElements). Both
 * paths used to parse independently; this module holds the one implementation
 * plus the caches so a value parsed for rendering is reused for filtering.
 *
 * It lives here rather than in valueMatchers/ because it is not a matcher:
 * the renderers in grafana-ui and the set matchers both depend on it.
 *
 * Cache strategy (changed from the original TableNG-local cache; the values
 * produced are identical, only the strategy differs): HEAD cached every
 * `typeof object` input by reference in a WeakMap. Only arrays use the WeakMap
 * now, while plain objects fall through to String() and share the bounded
 * string cache with every other scalar. Arrays are the only object inputs with
 * dedicated element semantics, so reference-caching anything else bought
 * nothing over the string form both paths already agreed on.
 */

const PILL_SPLIT_RE = /\s*,\s*/;

/**
 * A bounded cache with O(1) inserts and no per-insert eviction scan. It keeps two generations:
 * writes go to `primary`; when `primary` fills, it becomes `secondary` (whatever was in the old
 * `secondary` is dropped) and a fresh `primary` starts. Reads check both generations and promote a
 * survivor back into `primary`, which approximates LRU. Total live entries stay within ~2x maxSize.
 */
function createBoundedCache<K, V>(maxSize: number) {
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

// Pill inputs are stable across renders and filter passes, so results are cached. Array values are
// cached by reference in a WeakMap (unbounded-safe, auto-GC'd) along with the length they were
// split at, so a later push/size change re-splits instead of serving a stale tail. Primitive inputs
// persist for the whole app lifetime across every table, so they use a generational bounded cache
// sized generously enough that a large table mostly hits.
const arrayPillCache = new WeakMap<object, { elements: unknown[]; length: number }>();
const primitivePillCache = createBoundedCache<string, unknown[]>(15000);

function splitPillTextUncached(text: string): unknown[] {
  if (text[0] === '[') {
    try {
      const parsed: unknown = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return text.trim().split(PILL_SPLIT_RE);
    }
  }

  return text.trim().split(PILL_SPLIT_RE);
}

function splitPillArrayUncached(value: unknown[]): unknown[] {
  return value.filter((element) => element != null).map((element) => String(element).trim());
}

/**
 * @internal
 * Pill elements for a cell value, shared across rendering and filtering: the
 * same input returns the same cached array from either path. Arrays split per
 * element; anything else is stringified and split as pill text.
 *
 * Blank handling stays caller-specific and is NOT done here: rendering
 * (inferPills) maps '' to [] while filtering (splitFilterElements) maps '' to
 * ['']. Callers must also guard null/undefined themselves. As a consequence,
 * calling this helper directly with '' yields [''] (the plain split result).
 */
export function getPillElements(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    const cached = arrayPillCache.get(value);
    // Best-effort mutation guard: a length change proves the array was
    // resized after caching, so re-split. Same-length in-place element
    // replacement is undetectable here and may still read stale entries.
    if (cached !== undefined && cached.length === value.length) {
      return cached.elements;
    }
    const elements = splitPillArrayUncached(value);
    arrayPillCache.set(value, { elements, length: value.length });
    return elements;
  }

  const text = typeof value === 'string' ? value : String(value);
  let cached = primitivePillCache.get(text);
  if (cached === undefined) {
    cached = splitPillTextUncached(text);
    primitivePillCache.set(text, cached);
  }
  return cached;
}
