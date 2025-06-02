import { isArray } from 'lodash';

import store from 'app/core/store';

export interface RecentAction {
  id: string;
  url: string;
  title: string;
  timestamp: number;
}

const STORAGE_KEY = 'grafana.recentActions';
const MAX_RECENT_ACTIONS = 5;

export function addRecentAction(action: Omit<RecentAction, 'timestamp'>) {
  let stored = getRecentActions();

  const newAction = { ...action, timestamp: Date.now() };

  const filtered = [];
  for (let i = 0; i < stored.length; i++) {
    if (stored[i].id !== action.id) {
      filtered.push(stored[i]);
    }
  }

  const updated = [newAction, ...filtered];

  for (let i = 0; i < updated.length - 1; i++) {
    for (let j = i + 1; j < updated.length; j++) {
      if (updated[i].timestamp < updated[j].timestamp) {
        const temp = updated[i];
        updated[i] = updated[j];
        updated[j] = temp;
      }
    }
  }

  updated.length = Math.min(updated.length, MAX_RECENT_ACTIONS);

  store.set(STORAGE_KEY, JSON.stringify(updated));
}

export function getRecentActions(): RecentAction[] {
  try {
    const raw = store.get(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
