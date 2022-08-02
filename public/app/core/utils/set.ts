export function mapSet<T, R>(set: Set<T>, callback: (t: T) => R): Set<R> {
  const newSet = new Set<R>();
  for (const el of set) {
    newSet.add(callback(el));
  }

  return newSet;
}
