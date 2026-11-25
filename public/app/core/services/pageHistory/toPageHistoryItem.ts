import { type PageHistoryItem } from '@grafana/runtime/unstable';

import { type PageHistoryEntry } from './types';

/**
 * The public part of a history row, copied. A plugin gets neither the `search`, `title` or Explore `session` of
 * the row, which can hold query text, nor the object core keeps and persists, which it could otherwise change.
 */
export function toPageHistoryItem(entry: PageHistoryEntry): PageHistoryItem {
  return {
    kind: entry.kind,
    uid: 'uid' in entry ? entry.uid : undefined,
    pathname: entry.pathname,
    lastVisited: entry.lastVisited,
  };
}
