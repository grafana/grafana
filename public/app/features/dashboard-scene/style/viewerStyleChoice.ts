import { useSyncExternalStore } from 'react';

import { store } from '@grafana/data';

import { type DashboardStyleChoice } from './types';

/** What a viewer may override on a styled dashboard. Never saved to the dashboard. */
export type ViewerStyleChoice = Pick<DashboardStyleChoice, 'palette' | 'accent' | 'typography'>;

const keyFor = (uid: string) => `grafana.dashboard.style.${uid}`;
const listeners = new Set<() => void>();
const cache = new Map<string, ViewerStyleChoice | undefined>();

function read(uid: string): ViewerStyleChoice | undefined {
  if (!cache.has(uid)) {
    cache.set(uid, store.getObject<ViewerStyleChoice>(keyFor(uid)));
  }
  return cache.get(uid);
}

export function setViewerStyleChoice(uid: string, choice: ViewerStyleChoice | undefined) {
  const hasValues = choice && Object.values(choice).some(Boolean);
  if (hasValues) {
    store.setObject(keyFor(uid), choice);
  } else {
    store.delete(keyFor(uid));
  }
  cache.set(uid, hasValues ? choice : undefined);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The viewer's own palette, accent and typography for this dashboard, kept in their browser. */
export function useViewerStyleChoice(uid: string | undefined): ViewerStyleChoice | undefined {
  return useSyncExternalStore(subscribe, () => (uid ? read(uid) : undefined));
}
