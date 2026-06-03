import { useSyncExternalStore } from 'react';

import { store } from '@grafana/data';

const STORAGE_KEY = 'grafana.navigation.recentItems';
/** How many recent ids we retain. The menu surfaces only the first few of these. */
const MAX_STORED = 10;

const listeners = new Set<() => void>();
let snapshot: string[] = store.getObject<string[]>(STORAGE_KEY, []);

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

/** Record a nav item id as most-recently visited, newest first and de-duplicated. */
export function recordRecentNavItem(id: string) {
  if (snapshot[0] === id) {
    return;
  }
  snapshot = [id, ...snapshot.filter((existing) => existing !== id)].slice(0, MAX_STORED);
  store.setObject(STORAGE_KEY, snapshot);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

/** Reactive list of recently visited nav item ids, newest first. */
export function useRecentNavItemIds(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
