let generation = 0;
const listeners = new Set<() => void>();

// React compares external-store snapshots by identity. A number gives every committed cache
// mutation a stable snapshot without exposing the cache itself or allocating on every read.
export function getDataSourceCacheGeneration(): number {
  return generation;
}

export function subscribeToDataSourceCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyDataSourceCacheChanged(): void {
  generation++;
  for (const listener of listeners) {
    listener();
  }
}
