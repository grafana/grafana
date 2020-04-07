/**
 * Performs a shallow comparison of two sets with the same item type.
 */
export function equal<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  const it = a.values();
  while (true) {
    const { value, done } = it.next();
    if (done) {
      return true;
    }
    if (!b.has(value)) {
      return false;
    }
  }
}

/**
 * Returns a new set with items in both sets using shallow comparison.
 */
export function intersect<T>(a: Set<T>, b: Set<T>): Set<T> {
  const result = new Set<T>();
  const it = b.values();
  while (true) {
    const { value, done } = it.next();
    if (done) {
      return result;
    }
    if (a.has(value)) {
      result.add(value);
    }
  }
}
