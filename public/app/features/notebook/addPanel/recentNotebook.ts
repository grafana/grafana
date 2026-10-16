import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { store } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';

const RECENT_NOTEBOOK_KEY = 'grafana.notebooks.recentAdd';
const RECENT_ADD_WINDOW_MS = 4 * 60 * 60 * 1000;

export interface RecentNotebook {
  uid: string;
  title: string;
  at: number;
}

function storageKey(): string | undefined {
  const { id, orgId } = contextSrv.user;
  return id && orgId ? `${RECENT_NOTEBOOK_KEY}.${orgId}.${id}` : undefined;
}

export function getRecentNotebook(): RecentNotebook | undefined {
  const key = storageKey();
  if (!key) {
    return undefined;
  }

  let value: RecentNotebook | undefined;
  try {
    value = store.getObject<RecentNotebook>(key);
  } catch {
    return undefined;
  }
  if (
    !value ||
    typeof value.uid !== 'string' ||
    !value.uid ||
    typeof value.title !== 'string' ||
    !value.title ||
    typeof value.at !== 'number' ||
    !Number.isFinite(value.at) ||
    Date.now() - value.at < 0 ||
    Date.now() - value.at >= RECENT_ADD_WINDOW_MS
  ) {
    return undefined;
  }

  return value;
}

export function setRecentNotebook(uid: string, title: string): void {
  const key = storageKey();
  if (key && uid && title) {
    try {
      store.setObject(key, { uid, title, at: Date.now() });
    } catch {
      return;
    }
  }
}

export function clearRecentNotebook(): void {
  const key = storageKey();
  if (key) {
    try {
      store.delete(key);
    } catch {
      return;
    }
  }
}

export function useRecentNotebookVersion(): string | undefined {
  const key = storageKey();
  const subscribe = useCallback((onChange: () => void) => (key ? store.subscribe(key, onChange) : () => {}), [key]);
  const getSnapshot = useCallback(() => {
    try {
      return key ? store.get(key) : undefined;
    } catch {
      return undefined;
    }
  }, [key]);
  const value = useSyncExternalStore(subscribe, getSnapshot, () => undefined);
  const [expiry, setExpiry] = useState(0);

  useEffect(() => {
    const recent = getRecentNotebook();
    if (!recent) {
      return;
    }
    const timeout = window.setTimeout(
      () => setExpiry((current) => current + 1),
      recent.at + RECENT_ADD_WINDOW_MS - Date.now()
    );
    return () => window.clearTimeout(timeout);
  }, [value]);

  const recent = getRecentNotebook();
  return recent ? `${recent.at}.${expiry}` : undefined;
}
