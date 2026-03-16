import { store } from '@grafana/data';
import { useCallback, useSyncExternalStore } from 'react';

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

function setLocalStorageWithTTL<T>(key: string, value: T): void {
  store.setObject(key, { value, timestamp: Date.now() });
}

/**
 * React hook wrapping store from @grafana/data that adds TTL expiration.
 * Returns [value, setValue] where value falls back to defaultValue if missing/expired.
 */
export function useLocalStorageWithTTL<T>(
  key: string,
  defaultValue: T,
  ttlMs: number = ONE_WEEK_MS
): [T, (val: T) => void] {
  const subscribe = useCallback((cb: () => void) => store.subscribe(key, cb), [key]);
  const getSnapshot = useCallback(() => {
    const item = store.getObject<StoredValueWithTTL<T>>(key);
    if (!item || typeof item.timestamp !== 'number' || isExpired(item, ttlMs)) {
      return defaultValue;
    }
    return item.value;
  }, [key, ttlMs, defaultValue]);

  const value = useSyncExternalStore(subscribe, getSnapshot);

  const setValue = useCallback(
    (val: T) => {
      setLocalStorageWithTTL(key, val);
    },
    [key]
  );

  return [value, setValue];
}
