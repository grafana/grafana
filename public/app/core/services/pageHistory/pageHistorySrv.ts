import { type Location } from 'history';
import { throttle } from 'lodash';
import * as z from 'zod';

import { locationService } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';
import { type AppChromeService, getPageTitle } from 'app/core/components/AppChrome/AppChromeService';
import { isUrlRewrite } from 'app/core/navigation/urlRewrite';
import impressionSrv from 'app/core/services/impression_srv';
import { parseJsonWithSchema } from 'app/core/utils/parseJsonWithSchema';
import { isRenderTarget } from 'app/features/dashboard/services/isRenderTarget';

import { classifyPage, pageKey, recordableSearch } from './classifyPage';
import { type PageHistoryEntry, type PageHistoryKind } from './types';

const STORAGE_SERVICE = 'grafana-page-history';
/** One envelope per user; the user-storage namespace already separates orgs. */
const STORAGE_KEY = 'history';
/** Newest entries kept per kind, so a burst of one kind of page never evicts the others. */
export const PAGE_HISTORY_MAX_PER_KIND = 10;
/** Ordinary URL changes coalesce into one write per window; hiding the tab and `clear()` write at once. */
export const PAGE_HISTORY_PERSIST_MS = 30_000;
/**
 * `JSON.stringify(row).length` of one stored row. Heavy real URLs (a two-pane Explore session with long
 * queries, a dashboard with hundreds of multi-value variable values) stay around 10k. With the per-kind count
 * cap this bounds the whole list, and no one page can evict the others.
 */
export const PAGE_HISTORY_MAX_ENTRY_CHARS = 20_000;
/** JS `Date` range; larger values are not instants. */
const MAX_EPOCH_MS = 8.64e15;

/** Persisted row. The page identity is derived from the pathname on load, so a rule change reclassifies old rows. */
const StoredEntrySchema = z.object({
  pathname: z
    .string()
    .startsWith('/')
    .refine((pathname) => !pathname.startsWith('//')),
  search: z.string().refine((search) => search === '' || search.startsWith('?')),
  lastVisited: z.number().int().min(0).max(MAX_EPOCH_MS).optional(),
  title: z.string().optional(),
});

type StoredEntry = z.infer<typeof StoredEntrySchema>;

/** Everything stored under the key. `clearedAt` is the epoch ms of the last clear, 0 when never cleared. */
const StoredSchema = z.object({
  clearedAt: z.number().int().min(0).max(MAX_EPOCH_MS),
  entries: z.array(z.unknown()),
});

/** The stored copy as read: its `clearedAt`, and the rows that validated and still classify, as entries. */
interface Snapshot {
  clearedAt: number;
  entries: PageHistoryEntry[];
}

function toStored({ pathname, search, lastVisited, title }: PageHistoryEntry): StoredEntry {
  return { pathname, search, lastVisited, title };
}

/**
 * Whether `candidate` is the later revision of the page `existing` describes. A later visit wins; between equal
 * visits a titled row beats an untitled one, since the title arrives after the visit and carries no time of its
 * own; otherwise `existing` stays.
 */
function supersedes(candidate: PageHistoryEntry, existing: PageHistoryEntry): boolean {
  const byVisit = (candidate.lastVisited ?? 0) - (existing.lastVisited ?? 0);
  return byVisit !== 0 ? byVisit > 0 : Boolean(candidate.title) && !existing.title;
}

/**
 * Per page, keeps the later revision (`supersedes`); `current` is seen first, so it wins exact ties. Result is
 * newest first; rows without a time come last in their given order.
 */
function mergeByPage(current: PageHistoryEntry[], stored: PageHistoryEntry[]): PageHistoryEntry[] {
  const byKey = new Map<string, PageHistoryEntry>();
  for (const entry of [...current, ...stored]) {
    const key = pageKey(entry);
    const existing = byKey.get(key);
    if (!existing || supersedes(entry, existing)) {
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()].sort((a, b) => (b.lastVisited ?? 0) - (a.lastVisited ?? 0));
}

function fitsEntryCap(stored: StoredEntry): boolean {
  return JSON.stringify(stored).length <= PAGE_HISTORY_MAX_ENTRY_CHARS;
}

/** Newest N per kind, so a burst of one kind of page never evicts the others. */
function capEntries(entries: PageHistoryEntry[]): PageHistoryEntry[] {
  const kept = new Map<PageHistoryKind, number>();
  return entries.filter((entry) => {
    const count = kept.get(entry.kind) ?? 0;
    kept.set(entry.kind, count + 1);
    return count < PAGE_HISTORY_MAX_PER_KIND;
  });
}

/**
 * Validates the stored copy row by row so one bad or oversized entry drops only itself. Rows that no longer
 * classify are dropped. Anything but the envelope loads as empty.
 */
function parseStored(raw: string | null): Snapshot {
  const { clearedAt, entries: rows } = parseJsonWithSchema(raw, StoredSchema, { clearedAt: 0, entries: [] });
  const entries: PageHistoryEntry[] = [];
  for (const row of rows) {
    const result = StoredEntrySchema.safeParse(row);
    if (!result.success || !fitsEntryCap(result.data)) {
      continue;
    }
    const page = classifyPage(result.data.pathname, result.data.search);
    if (page) {
      entries.push({ ...result.data, ...page });
    }
  }
  return { clearedAt, entries };
}

function serialize(clearedAt: number, entries: PageHistoryEntry[]): string {
  return JSON.stringify({ clearedAt, entries: entries.map(toStored) });
}

/**
 * Records the pages the user visits (with their URL state) so the homepage can link back to them.
 * One envelope per user and org in `UserStorage`. Every write merges with the stored copy under a version check,
 * so tabs and browsers converge; localStorage is used only for signed-out users and is not a fallback for
 * failed requests.
 *
 * Request policy: ordinary URL changes coalesce into one write at most every `PAGE_HISTORY_PERSIST_MS` per tab;
 * hiding the tab and `clear()` write immediately; every `getEntries()` and the startup load each cost one read.
 * A write is one read plus one write, plus one more pair per version conflict. A failed write is retried by the
 * next change or tab hide, never on a timer. Overlapping operations in one tab serialize on `UserStorage`'s
 * lock; a change made while a write is in flight is picked up by the next one. The write on tab hide is a plain
 * request, so closing the tab can lose the changes of the current window.
 */
export class PageHistorySrv {
  /** Newest first by construction; `lastVisited` is only used for merging and display. */
  private entries: PageHistoryEntry[] = [];
  /** Epoch ms of the last clear seen from any tab; rows visited at or before it are dropped. */
  private clearedAt = 0;
  /** Memory holds a change that storage has not confirmed. */
  private dirty = false;
  private readonly storage = new UserStorage(STORAGE_SERVICE);
  private ready: Promise<void> | undefined;

  private readonly scheduleWrite = throttle(() => this.write(), PAGE_HISTORY_PERSIST_MS, {
    leading: false,
    trailing: true,
  });

  /** Starts recording. Returns a function that stops it and drops any pending write. Renderer sessions record nothing. */
  start(chrome: AppChromeService): () => void {
    // Image-renderer and report captures load pages as the user; their visits are not the user's.
    if (isRenderTarget()) {
      return () => {};
    }
    this.ready = this.load();

    // `history.listen` never emits the landing page.
    this.apply(locationService.getLocation(), false);

    const unlisten = locationService
      .getHistory()
      .listen((location, action) => this.apply(location, action === 'REPLACE' && isUrlRewrite(location.state)));
    // Pages set their nav after they render, so the title arrives after the navigation was recorded.
    const chromeSubscription = chrome.state.subscribe((state) => this.setTitle(getPageTitle(state)));
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && this.dirty) {
        void this.writeNow();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      unlisten();
      chromeSubscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      this.scheduleWrite.cancel();
    };
  }

  /** Newest first, including what other tabs and browsers recorded. Empty until recording has started. */
  async getEntries(): Promise<PageHistoryEntry[]> {
    if (!this.ready) {
      return [];
    }
    await this.ready;
    await this.sync(false);
    return [...this.entries];
  }

  /**
   * Forgets every recorded page, in every tab and browser, and persists right away. Resolves after the first
   * attempt whether or not it reached storage; a failed attempt is retried like any other change.
   */
  async clear(): Promise<void> {
    if (!this.ready) {
      return;
    }
    await this.ready;
    this.clearedAt = this.now();
    this.entries = [];
    this.dirty = true;
    await this.writeNow();
  }

  private async load(): Promise<void> {
    // An unreachable store must not seed: it may well hold a history already.
    if ((await this.sync(false)) === 'empty') {
      await this.seed();
    }
  }

  /**
   * First use for this user and org: carries the newest dashboards over from the recently-viewed impressions.
   * They have no visit time, so they sort after every recorded page and are the first to be evicted. A bridge
   * for users who had a Recent tab before page history; remove once that is a few releases back.
   */
  private async seed(): Promise<void> {
    let uids: string[] = [];
    try {
      uids = await impressionSrv.getDashboardOpened();
    } catch (e) {
      console.warn('Page history: seed failed', e);
    }
    const seeded: PageHistoryEntry[] = uids
      .slice(0, PAGE_HISTORY_MAX_PER_KIND)
      .map((uid) => ({ kind: 'dashboard', uid, pathname: `/d/${uid}`, search: '' }));
    this.entries = capEntries(mergeByPage(this.entries, seeded));
    this.persist();
  }

  /** Folds the stored copy into memory: the latest clear wins and drops the rows it predates; rows merge by page. */
  private absorb(snapshot: Snapshot): void {
    this.clearedAt = Math.max(this.clearedAt, snapshot.clearedAt);
    this.entries = capEntries(
      mergeByPage(this.entries, snapshot.entries).filter(
        // Rows without a time (seeded) survive only while nothing was ever cleared.
        (entry) => this.clearedAt === 0 || (entry.lastVisited ?? 0) > this.clearedAt
      )
    );
  }

  /**
   * Merges the stored copy into memory and, with `persist`, stores the result when it differs. `empty`: nothing
   * has ever been stored for this user and org. `unreachable`: a request failed and nothing was stored.
   */
  private async sync(persist: boolean): Promise<'merged' | 'empty' | 'unreachable'> {
    let outcome: 'merged' | 'empty' = 'empty';
    try {
      await this.storage.updateItem(STORAGE_KEY, (raw) => {
        outcome = raw === null ? 'empty' : 'merged';
        // Runs again after a version conflict, so this must stay idempotent: `absorb` merges by key.
        this.absorb(parseStored(raw));
        const next = serialize(this.clearedAt, this.entries);
        return persist && next !== raw ? next : undefined;
      });
      return outcome;
    } catch (e) {
      console.warn('Page history: storage unavailable', e);
      return 'unreachable';
    }
  }

  private apply(location: Location, isRewrite: boolean): void {
    const page = classifyPage(location.pathname, location.search);
    if (!page) {
      return;
    }
    const key = pageKey(page);
    const existing = this.entries.find((entry) => pageKey(entry) === key);
    // A flagged REPLACE corrects the URL of the page the user is on: it refreshes that page's row but never
    // adds one, so the `/` → home dashboard rewrite does not list the home dashboard.
    if (isRewrite && !existing) {
      return;
    }

    // Hash deliberately ignored. Query churn refreshes the search and moves the row to the top.
    const entry: PageHistoryEntry = {
      ...page,
      search: recordableSearch(page, location.search),
      lastVisited: this.now(),
      // Kept until the page sets its nav again, in case the user leaves before it does.
      title: existing?.title,
    };
    // A URL too large to store is not recorded; the page's earlier row, if any, stays as it was.
    if (!fitsEntryCap(toStored(entry))) {
      return;
    }
    this.entries = capEntries([entry, ...this.entries.filter((other) => other !== existing)]);
    this.persist();
  }

  /**
   * Stamps the chrome's title onto the row of the page the user is on, if that page has one. The chrome does
   * not say which page set its nav, and keeps the previous page's nav across a navigation within one route
   * (dashboard to dashboard, one app page to another), so a new row can briefly carry the previous page's title;
   * the page's own nav replaces it once set. A title that would push the row over the size cap is dropped and
   * the row keeps its URL.
   */
  private setTitle(title: string | undefined): void {
    if (!title) {
      return;
    }
    const { pathname, search } = locationService.getLocation();
    const page = classifyPage(pathname, search);
    const key = page && pageKey(page);
    const index = key ? this.entries.findIndex((entry) => pageKey(entry) === key) : -1;
    if (index === -1 || this.entries[index].title === title) {
      return;
    }
    const titled = { ...this.entries[index], title };
    if (!fitsEntryCap(toStored(titled))) {
      return;
    }
    this.entries = this.entries.map((entry, i) => (i === index ? titled : entry));
    this.persist();
  }

  /**
   * Revision stamp for a change made now: the wall clock, but always past the last clear seen. A device whose
   * clock lags the one that cleared would otherwise record visits the clear predates, and they would vanish on
   * every sync until its clock caught up.
   */
  private now(): number {
    return Math.max(Date.now(), this.clearedAt + 1);
  }

  /** Something changed: written at the end of the current window. */
  private persist(): void {
    this.dirty = true;
    this.scheduleWrite();
  }

  /** Writes now instead of at the end of the window. */
  private writeNow(): Promise<void> {
    this.scheduleWrite.cancel();
    return this.write();
  }

  private async write(): Promise<void> {
    // Never overwrite the stored copy before it has been merged in.
    await this.ready;
    // Cleared first so a change made while this write is in flight stays pending.
    this.dirty = false;
    if ((await this.sync(true)) === 'unreachable') {
      this.dirty = true;
    }
  }
}

export const pageHistorySrv = new PageHistorySrv();
