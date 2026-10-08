import { type Location } from 'history';
import { debounce } from 'lodash';
import * as z from 'zod';

import { locationService } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';
import { type AppChromeService, getPageTitle } from 'app/core/components/AppChrome/AppChromeService';
import { isUrlRewrite } from 'app/core/navigation/urlRewrite';
import { contextSrv } from 'app/core/services/context_srv';
import { parseJsonWithSchema } from 'app/core/utils/parseJsonWithSchema';

import { classifyPage, pageKey } from './classifyPage';
import { PAGE_HISTORY_MAX_PER_KIND, type PageHistoryEntry, type PageHistoryKind } from './types';

const STORAGE_SERVICE = 'grafana-page-history';
const PERSIST_MS = 1000;
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
  lastVisited: z.number().int().min(0).max(MAX_EPOCH_MS),
  title: z.string().optional(),
});

type StoredEntry = z.infer<typeof StoredEntrySchema>;

function toStored({ pathname, search, lastVisited, title }: PageHistoryEntry): StoredEntry {
  return { pathname, search, lastVisited, title };
}

/** Per page, keeps the entry with the larger `lastVisited`; `current` wins ties. Result is newest first. */
function mergeByPage(current: PageHistoryEntry[], stored: PageHistoryEntry[]): PageHistoryEntry[] {
  const byKey = new Map<string, PageHistoryEntry>();
  for (const entry of [...current, ...stored]) {
    const key = pageKey(entry);
    const existing = byKey.get(key);
    if (!existing || entry.lastVisited > existing.lastVisited) {
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()].sort((a, b) => b.lastVisited - a.lastVisited);
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

/** Validates the stored copy row by row so one bad or oversized entry drops only itself. Rows that no longer classify are dropped. */
function parseEntries(raw: string | null): PageHistoryEntry[] {
  const entries: PageHistoryEntry[] = [];
  for (const row of parseJsonWithSchema(raw, z.array(z.unknown()), [])) {
    const result = StoredEntrySchema.safeParse(row);
    if (!result.success || !fitsEntryCap(result.data)) {
      continue;
    }
    const page = classifyPage(result.data.pathname, result.data.search);
    if (page) {
      entries.push({ ...result.data, ...page });
    }
  }
  return entries;
}

/**
 * Records the pages the user visits (with their URL state) so the homepage can link back to them.
 * One list per user in `UserStorage`, whose resource is already namespaced per org; the per-org item key only
 * matters for its localStorage fallback (anonymous users, storage unavailable), which is not.
 */
export class PageHistorySrv {
  /** Newest first by construction; `lastVisited` is only used for merging and display. */
  private entries: PageHistoryEntry[] = [];
  /** Key of the page the user is on, listed or not, so a change of page is told apart from churn on it. */
  private locationKey: string | null = null;
  /** Key of the recorded page the user is on; titles from the chrome are stamped onto it. */
  private currentKey: string | undefined;
  private readonly storage = new UserStorage(STORAGE_SERVICE);
  private readonly key = `org-${contextSrv.user.orgId}`;
  private ready: Promise<void> | undefined;

  private persist = debounce(() => this.write(), PERSIST_MS);

  /** Starts recording. Returns a function that stops it and drops any pending write. */
  start(chrome: AppChromeService): () => void {
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

  /** Newest first. Empty until recording has started. */
  async getEntries(): Promise<PageHistoryEntry[]> {
    if (!this.ready) {
      return [];
    }
    await this.ready;
    return [...this.entries];
  }

  /** Forgets every recorded page and persists the empty list right away. */
  async clear(): Promise<void> {
    await this.ready;
    this.entries = [];
    this.persist.cancel();
    await this.write();
  }

  private async load(): Promise<void> {
    let stored: PageHistoryEntry[] = [];
    try {
      stored = parseEntries(await this.storage.getItem(this.key));
    } catch (e) {
      console.warn('Page history: load failed', e);
    }
    // Pages visited while loading are already in memory and newer than anything stored, so they win.
    this.entries = capEntries(mergeByPage(this.entries, stored));
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
      search: location.search,
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
    try {
      await this.storage.setItem(this.key, JSON.stringify(this.entries.map(toStored)));
    } catch (e) {
      console.warn('Page history: save failed', e);
    }
  }
}

export const pageHistorySrv = new PageHistorySrv();
