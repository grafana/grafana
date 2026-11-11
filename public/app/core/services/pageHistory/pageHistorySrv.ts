import { type Location } from 'history';
import { throttle } from 'lodash';
import { distinctUntilChanged } from 'rxjs';
import * as z from 'zod';

import { type NavModelItem } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';
import { type AppChromeService, getPageTitle } from 'app/core/components/AppChrome/AppChromeService';
import { isUrlRewrite } from 'app/core/navigation/urlRewrite';
import impressionSrv from 'app/core/services/impression_srv';
import { parseJsonWithSchema } from 'app/core/utils/parseJsonWithSchema';
import { isRenderTarget } from 'app/features/dashboard/services/isRenderTarget';

import { classifyPage, recordableSearch } from './classifyPage';
import { hasNothingToResume } from './hasNothingToResume';
import {
  clearHistory,
  EMPTY_HISTORY,
  fitsEntryCap,
  type HistorySnapshot,
  type HistoryState,
  mergeStored,
  PAGE_HISTORY_MAX_PER_KIND,
  recordTitle,
  recordVisit,
  toStored,
} from './pageHistoryState';
import { type PageHistoryEntry } from './types';

const STORAGE_SERVICE = 'grafana-page-history';
/** One envelope per user; the user-storage namespace already separates orgs. */
const STORAGE_KEY = 'history';
/** Ordinary URL changes coalesce into one write per window; hiding the tab and `clear()` write at once. */
export const PAGE_HISTORY_PERSIST_MS = 30_000;
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

/** Everything stored under the key. `clearedAt` is the epoch ms of the last clear, 0 when never cleared. */
const StoredSchema = z.object({
  clearedAt: z.number().int().min(0).max(MAX_EPOCH_MS),
  entries: z.array(z.unknown()),
});

/**
 * Validates the stored copy row by row so one bad or oversized entry drops only itself. Rows that no longer
 * classify are dropped. Anything but the envelope loads as empty.
 */
function parseStored(raw: string | null): HistorySnapshot {
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

function serialize({ clearedAt, entries }: HistoryState): string {
  return JSON.stringify({ clearedAt, entries: entries.map(toStored) });
}

/**
 * Records the pages the user visits (with their URL state) so the homepage can link back to them.
 * One envelope per user and org in `UserStorage`. Every write merges with the stored copy under a version check,
 * so tabs and browsers converge; localStorage is used only for signed-out users and is not a fallback for
 * failed requests. The merge rules live in `pageHistoryState`; this class wires events and storage to them.
 *
 * Request policy: ordinary URL changes coalesce into one write at most every `PAGE_HISTORY_PERSIST_MS` per tab;
 * hiding the tab and `clear()` write immediately; every `getEntries()` and the startup load each cost one read.
 * A write is one read plus one write, plus one more pair per version conflict. A failed write is retried by the
 * next change or tab hide, never on a timer. Overlapping operations in one tab serialize on `UserStorage`'s
 * lock; a change made while a write is in flight is picked up by the next one. The write on tab hide is a plain
 * request, so closing the tab can lose the changes of the current window.
 */
export class PageHistorySrv {
  private state = EMPTY_HISTORY;
  /** Memory holds a change that storage has not confirmed. */
  private dirty = false;
  private readonly storage = new UserStorage(STORAGE_SERVICE);
  private ready: Promise<void> | undefined;
  /**
   * Changes made before the stored copy is in, replayed in order once it is. A visit that only refreshes a
   * page's row (a menu destination, a rewrite) has to see the stored row, or it finds none and changes nothing.
   */
  private pending: Array<() => void> | undefined = [];
  /** The menu as it is now, read per visit: items come and go with permissions, plugins and bookmarks. */
  private navTree: () => NavModelItem[] = () => [];

  private readonly scheduleWrite = throttle(() => this.write(), PAGE_HISTORY_PERSIST_MS, {
    leading: false,
    trailing: true,
  });

  /**
   * Starts recording. `navTree` is read on every visit to tell menu destinations from pages worth a row. Returns a
   * function that stops recording and drops any pending write. Renderer sessions record nothing.
   */
  start(chrome: AppChromeService, navTree: () => NavModelItem[]): () => void {
    // Image-renderer and report captures load pages as the user; their visits are not the user's.
    if (isRenderTarget()) {
      return () => {};
    }
    this.ready = this.load();
    this.navTree = navTree;

    // `history.listen` never emits the landing page.
    this.apply(locationService.getLocation(), false);

    const unlisten = locationService
      .getHistory()
      .listen((location, action) => this.apply(location, action === 'REPLACE' && isUrlRewrite(location.state)));
    // Pages set their nav after they render, so the title arrives after the navigation was recorded. Only a nav
    // change is a page setting its nav; other chrome updates keep the previous page's nav objects.
    const chromeSubscription = chrome.state
      .pipe(distinctUntilChanged((a, b) => a.sectionNav === b.sectionNav && a.pageNav === b.pageNav))
      .subscribe((state) => this.setTitle(getPageTitle(state)));
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
      this.pending = undefined;
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
    return [...this.state.entries];
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
    this.state = clearHistory(this.state, Date.now());
    this.dirty = true;
    await this.writeNow();
  }

  private async load(): Promise<void> {
    // An unreachable store must not seed: it may well hold a history already.
    if ((await this.sync(false)) === 'empty') {
      await this.seed();
    }
    const pending = this.pending;
    this.pending = undefined;
    pending?.forEach((change) => change());
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
    this.state = mergeStored(this.state, { clearedAt: 0, entries: seeded });
    this.persist();
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
        // Runs again after a version conflict; `mergeStored` is idempotent, so that is safe.
        this.state = mergeStored(this.state, parseStored(raw));
        const next = serialize(this.state);
        return persist && next !== raw ? next : undefined;
      });
      return outcome;
    } catch (e) {
      console.warn('Page history: storage unavailable', e);
      return 'unreachable';
    }
  }

  /** Hash deliberately ignored. */
  private apply(location: Location, isRewrite: boolean): void {
    const page = classifyPage(location.pathname, location.search);
    if (!page) {
      return;
    }
    // A page with nothing to resume gets no row, but a row it has is refreshed to where the user left it.
    const refreshOnly = isRewrite || hasNothingToResume(page, location.search, this.navTree());
    const search = recordableSearch(page, location.search);
    const at = Date.now();
    this.record(() => recordVisit(this.state, page, search, at, refreshOnly));
  }

  /**
   * Stamps the chrome's title onto the row of the page the user is on, if that page has one. The chrome does not
   * say which page a nav belongs to and keeps the previous page's nav across a navigation within one route
   * (dashboard to dashboard, one app page to another), so a new row stays untitled until its own page sets its
   * nav. A nav the departed page sets after the navigation still lands on the new row; the page's own nav
   * replaces it once set.
   */
  private setTitle(title: string | undefined): void {
    if (!title) {
      return;
    }
    const { pathname, search } = locationService.getLocation();
    const page = classifyPage(pathname, search);
    if (page) {
      const at = Date.now();
      this.record(() => recordTitle(this.state, page, title, at));
    }
  }

  /**
   * Applies `change` to the state, after the stored copy is in. Stamps are taken when the change is made, so a
   * replay keeps the order of events; the write it arms waits for the load as every write does.
   */
  private record(change: () => HistoryState): void {
    if (this.pending) {
      this.pending.push(() => this.update(change()));
      this.persist();
      return;
    }
    this.update(change());
  }

  /** Adopts a change made in this tab, if `next` is one: written at the end of the current window. */
  private update(next: HistoryState): void {
    if (next === this.state) {
      return;
    }
    this.state = next;
    this.persist();
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
