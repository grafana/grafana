import { store } from '@grafana/data';

const STORAGE_PREFIX = 'grafana.recentQueries.filterDefaults';

export function getStoredFilterDefaults<T>(namespace: string): Partial<T> {
  try {
    const raw = store.get(`${STORAGE_PREFIX}.${namespace}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function storeFilterDefaults<T>(namespace: string, filters: T): void {
  store.set(`${STORAGE_PREFIX}.${namespace}`, JSON.stringify(filters));
}
