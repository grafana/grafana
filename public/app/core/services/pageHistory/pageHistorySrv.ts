import { type Location } from 'history';
import { throttle } from 'lodash';
import * as z from 'zod';

import { locationService } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';
import { type AppChromeService, getPageTitle } from 'app/core/components/AppChrome/AppChromeService';
import { isUrlRewrite } from 'app/core/navigation/urlRewrite';
import { contextSrv } from 'app/core/services/context_srv';
import impressionSrv from 'app/core/services/impression_srv';
import { parseJsonWithSchema } from 'app/core/utils/parseJsonWithSchema';
import { isRenderTarget } from 'app/features/dashboard/services/isRenderTarget';

import { classifyPage, pageKey, recordableSearch } from './classifyPage';
import { PAGE_HISTORY_MAX_PER_KIND, type PageHistoryEntry, type PageHistoryKind } from './types';

const STORAGE_SERVICE = 'grafana-page-history';
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

/** Everything stored under the org key. `clearedAt` is the epoch ms of the last clear, 0 when never cleared. */
const StoredSchema = z.object({
  clearedAt: z.number().int().min(0).max(MAX_EPOCH_MS),
  entries: z.array(z.unknown()),
});

interface Stored {
  clearedAt: number;
  entries: PageHistoryEntry[];
}

function toStored({ pathname, search, lastVisited, title }: PageHistoryEntry): StoredEntry {
  return { pathname, search, lastVisited, title };
}

/**
 * Per page, keeps the entry with the larger `lastVisited`; `current` wins ties. Result is newest first; rows
 * without a time come last in their given order.
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
function parseStored(raw: string | null): Stored {
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
 * A write is one read plus one write, plus one more pair per version conflict. Overlapping operations in one tab
 * serialize on `UserStorage`'s lock; a change made while a write is in flight is picked up by the next one.
 */
export class PageHistorySrv {
  /** Newest first by construction; `lastVisited` is only used for merging and display. */
  private entries: PageHistoryEntry[] = [];
  /** Key of the page the user is on, listed or not, so a change of page is told apart from churn on it. */
  private locationKey: string | null = null;
  /** Key of the recorded page the user is on; titles from the chrome are stamped onto it. */
  private currentKey: string | undefined;
  /** Epoch ms of the last clear seen from any tab; rows visited at or before it are dropped. */
  private clearedAt = 0;
  private readonly storage = new UserStorage(STORAGE_SERVICE);
  private readonly key = `org-${contextSrv.user.orgId}`;
  private ready: Promise<void> | undefined;

  private persist = throttle(() => this.write(), PAGE_HISTORY_PERSIST_MS, { leading: false, trailing: true });

  /** Starts recording. Returns a function that stops it and drops any pending write. Renderer sessions record nothing. */
  start(chrome: AppChromeService): () => void {
    // Image-renderer and report captures load pages as the user; their visits are not the user's.
    if (isRenderTarget()) {
      return () => {};
    }
    this.ready = this.load();

    // `history.listen` never emits the landing page.
    this.apply(locationService.getLocation(), false);

    const unlisten = locationService.getHistory().listen((location, action) =>
      // A flagged REPLACE corrects the current page's URL in place and is never a navigation.
      this.apply(location, action === 'REPLACE' && isUrlRewrite(location.state))
    );
    // Pages set their nav after they render, so the title arrives after the navigation was recorded.
    const chromeSubscription = chrome.state.subscribe((state) => this.setTitle(getPageTitle(state)));
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        this.persist.flush();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      unlisten();
      chromeSubscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      this.persist.cancel();
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
   * attempt whether or not it reached storage; a failed attempt is retried on the next write.
   */
  async clear(): Promise<void> {
    if (!this.ready) {
      return;
    }
    await this.ready;
    this.clearedAt = Date.now();
    this.entries = [];
    this.currentKey = undefined;
    this.persist.cancel();
    await this.write();
  }

  private async load(): Promise<void> {
    // `null` means nothing was ever stored for this user and org; an unreadable store must not seed.
    if ((await this.sync(false)) === null) {
      await this.seed();
    }
  }

  /**
   * First use for this user and org: carries the newest dashboards over from the recently-viewed impressions.
   * They have no visit time, so they sort after every recorded page and are the first to be evicted.
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
  private absorb(stored: Stored): void {
    this.clearedAt = Math.max(this.clearedAt, stored.clearedAt);
    this.entries = capEntries(
      mergeByPage(this.entries, stored.entries).filter(
        // Rows without a time (seeded) survive only while nothing was ever cleared.
        (entry) => this.clearedAt === 0 || (entry.lastVisited ?? 0) > this.clearedAt
      )
    );
    // The page the user is on may have been cleared elsewhere; its next URL change must record it again.
    if (this.currentKey && !this.entries.some((entry) => pageKey(entry) === this.currentKey)) {
      this.currentKey = undefined;
      this.locationKey = null;
    }
  }

  /**
   * Merges the stored copy into memory and, with `persist`, stores the result when it differs. Resolves with the
   * stored string as read (`null` when nothing is stored), or `undefined` when storage was unreachable.
   */
  private async sync(persist: boolean): Promise<string | null | undefined> {
    let read: string | null | undefined;
    try {
      await this.storage.updateItem(this.key, (raw) => {
        read = raw;
        // Runs again after a version conflict, so this must stay idempotent: `absorb` merges by key.
        this.absorb(parseStored(raw));
        const next = serialize(this.clearedAt, this.entries);
        return persist && next !== raw ? next : undefined;
      });
      return read;
    } catch (e) {
      console.warn('Page history: storage unavailable', e);
      return undefined;
    }
  }

  private apply(location: Location, isRewrite: boolean): void {
    const page = classifyPage(location.pathname, location.search);
    const key = page && pageKey(page);
    // Query churn keeps the key, so only a key change is a navigation. Explore writes its state with a plain
    // REPLACE on the same pathname, which is how its sessions come to exist.
    const isNavigation = !isRewrite && key !== this.locationKey;
    this.locationKey = key;
    this.currentKey = undefined;
    if (!page || !key) {
      return;
    }

    const existing = this.entries.find((entry) => pageKey(entry) === key);
    // Churn or rewrite onto a page never navigated to (e.g. `/` → home dashboard rewrite).
    if (!existing && !isNavigation) {
      return;
    }

    // Hash deliberately ignored. Query churn refreshes the search and moves the row to the top.
    const entry: PageHistoryEntry = {
      ...page,
      search: recordableSearch(page, location.search),
      lastVisited: Date.now(),
      // Kept until the page sets its nav again, in case the user leaves before it does.
      title: existing?.title,
    };
    // A URL too large to store is not recorded; the page's earlier row, if any, stays as it was.
    if (!fitsEntryCap(toStored(entry))) {
      return;
    }
    this.entries = capEntries([entry, ...this.entries.filter((other) => other !== existing)]);
    this.currentKey = key;
    this.persist();
  }

  private setTitle(title: string | undefined): void {
    if (!title || !this.currentKey) {
      return;
    }
    const index = this.entries.findIndex((entry) => pageKey(entry) === this.currentKey);
    if (index === -1 || this.entries[index].title === title) {
      return;
    }
    this.entries[index] = { ...this.entries[index], title };
    this.persist();
  }

  private async write(): Promise<void> {
    // Never overwrite the stored copy before it has been merged in.
    await this.ready;
    // Memory stays as it is on failure; the next window retries while the tab lives.
    if ((await this.sync(true)) === undefined) {
      this.persist();
    }
  }
}

export const pageHistorySrv = new PageHistorySrv();
