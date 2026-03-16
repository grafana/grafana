import { store } from '@grafana/data';

interface StoredValueWithTTL<T> {
  value: T;
  timestamp: number;
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isExpired<T>(item: StoredValueWithTTL<T>, ttlMs: number): boolean {
  return Date.now() - item.timestamp > ttlMs;
}

/**
 * Read a TTL-wrapped value from localStorage (non-hook, for use outside React components).
 * Returns null if missing or expired.
 */
export function getLocalStorageWithTTL<T>(key: string, ttlMs: number = ONE_WEEK_MS): T | null {
  const item = store.getObject<StoredValueWithTTL<T>>(key);
  if (!item || typeof item.timestamp !== 'number' || isExpired(item, ttlMs)) {
    store.delete(key);
    return null;
  }
  return item.value;
}
