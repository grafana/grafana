import { pageKey } from './classifyPage';
import { type PageHistoryEntry, type PageHistoryKind, type PageIdentity } from './types';

/** Newest entries kept per kind, so a burst of one kind of page never evicts the others. */
export const PAGE_HISTORY_MAX_PER_KIND = 10;
/**
 * `JSON.stringify(row).length` of one stored row. Heavy real URLs (a two-pane Explore session with long
 * queries, a dashboard with hundreds of multi-value variable values) stay around 10k. With the per-kind count
 * cap this bounds the whole list, and no one page can evict the others.
 */
export const PAGE_HISTORY_MAX_ENTRY_CHARS = 20_000;

/**
 * The history as one tab holds it. Every change (visit, title, clear) is a revision carrying a stamp, so two
 * copies merge by keeping the later revision of each page, and a clear drops every row it postdates.
 */
export interface HistoryState {
  /** Newest first. */
  entries: PageHistoryEntry[];
  /** Stamp of the last clear seen from any tab, 0 when never cleared; rows stamped at or before it are dropped. */
  clearedAt: number;
  /** Largest stamp seen so far, from this tab or a stored copy; new stamps go past it. */
  latest: number;
}

export const EMPTY_HISTORY: HistoryState = { entries: [], clearedAt: 0, latest: 0 };

/** A stored copy as read: its clear stamp and the rows that validated. */
export interface HistorySnapshot {
  clearedAt: number;
  entries: PageHistoryEntry[];
}

/** What a row looks like in storage. The page identity is derived again from these fields on load. */
export interface StoredEntry {
  pathname: string;
  search: string;
  lastVisited?: number;
  title?: string;
}

export function toStored({ pathname, search, lastVisited, title }: PageHistoryEntry): StoredEntry {
  return { pathname, search, lastVisited, title };
}

export function fitsEntryCap(stored: StoredEntry): boolean {
  return JSON.stringify(stored).length <= PAGE_HISTORY_MAX_ENTRY_CHARS;
}

/** Folds a stored copy in: the latest clear wins and drops the rows it predates; rows merge by page. Idempotent. */
export function mergeStored(state: HistoryState, snapshot: HistorySnapshot): HistoryState {
  const latest = Math.max(state.latest, snapshot.clearedAt, ...snapshot.entries.map((entry) => entry.lastVisited ?? 0));
  const clearedAt = Math.max(state.clearedAt, snapshot.clearedAt);
  const entries = capEntries(
    mergeByPage(state.entries, snapshot.entries).filter(
      // Rows without a time (seeded) survive only while nothing was ever cleared.
      (entry) => clearedAt === 0 || (entry.lastVisited ?? 0) > clearedAt
    )
  );
  return { entries, clearedAt, latest };
}

/**
 * Records a visit to `page` with `search` as the state to come back to. Query churn refreshes the search and
 * moves the row to the top. With `refreshOnly` the visit refreshes the page's row but never adds one: a rewrite
 * (a REPLACE that corrects the URL of the page the user is on) must not list the home dashboard the `/` rewrite
 * lands on, and a page with nothing to resume is not worth a row, but a row it already has must say where the
 * user left it. Returns `state` itself when nothing is recorded.
 */
export function recordVisit(
  state: HistoryState,
  page: PageIdentity,
  search: string,
  wallClock: number,
  refreshOnly: boolean
): HistoryState {
  const existing = findRow(state, page);
  if (refreshOnly && !existing) {
    return state;
  }
  // The title is kept until the page sets its nav again, in case the user leaves before it does.
  return upsert(state, { ...page, search, lastVisited: stamp(state, wallClock), title: existing?.title }, existing);
}

/**
 * Stamps `title` onto the row of `page` as a new revision, so a tab holding the older title loses the merge.
 * Returns `state` itself when the page has no row or its row already carries the title.
 */
export function recordTitle(state: HistoryState, page: PageIdentity, title: string, wallClock: number): HistoryState {
  const existing = findRow(state, page);
  if (!existing || existing.title === title) {
    return state;
  }
  return upsert(state, { ...existing, title, lastVisited: stamp(state, wallClock) }, existing);
}

/** Forgets every row. The clear is stamped past everything seen, so every other copy drops its rows too. */
export function clearHistory(state: HistoryState, wallClock: number): HistoryState {
  const clearedAt = stamp(state, wallClock);
  return { entries: [], clearedAt, latest: clearedAt };
}

/**
 * Revision stamp for a change made at `wallClock`: past every stamp seen, so a local change always wins the
 * merge and a title stamped in the same millisecond as its visit is still the later revision. A device whose
 * clock lags one that cleared would otherwise record visits the clear predates, and they would vanish on every
 * sync until its clock caught up.
 */
function stamp(state: HistoryState, wallClock: number): number {
  return Math.max(wallClock, state.latest + 1);
}

function findRow(state: HistoryState, page: PageIdentity): PageHistoryEntry | undefined {
  const key = pageKey(page);
  return state.entries.find((entry) => pageKey(entry) === key);
}

/**
 * Puts `entry` at the top in place of `existing`. An entry too large to store is not recorded, so a URL over the
 * cap leaves the page's earlier row as it was and a title that pushes a row over the cap is dropped.
 */
function upsert(
  state: HistoryState,
  entry: PageHistoryEntry & { lastVisited: number },
  existing: PageHistoryEntry | undefined
): HistoryState {
  if (!fitsEntryCap(toStored(entry))) {
    return state;
  }
  return {
    ...state,
    latest: entry.lastVisited,
    entries: capEntries([entry, ...state.entries.filter((other) => other !== existing)]),
  };
}

/**
 * Per page, keeps the latest revision; `current` is seen first, so it wins an exact tie, which only two tabs
 * stamping the same millisecond can produce. Result is newest first; rows without a time come last in their
 * given order.
 */
function mergeByPage(current: PageHistoryEntry[], stored: PageHistoryEntry[]): PageHistoryEntry[] {
  const byKey = new Map<string, PageHistoryEntry>();
  for (const entry of [...current, ...stored]) {
    const key = pageKey(entry);
    const existing = byKey.get(key);
    if (!existing || (entry.lastVisited ?? 0) > (existing.lastVisited ?? 0)) {
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()].sort((a, b) => (b.lastVisited ?? 0) - (a.lastVisited ?? 0));
}

/** Newest N per kind. */
function capEntries(entries: PageHistoryEntry[]): PageHistoryEntry[] {
  const kept = new Map<PageHistoryKind, number>();
  return entries.filter((entry) => {
    const count = kept.get(entry.kind) ?? 0;
    kept.set(entry.kind, count + 1);
    return count < PAGE_HISTORY_MAX_PER_KIND;
  });
}
