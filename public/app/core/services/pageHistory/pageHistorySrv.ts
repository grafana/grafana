import { type Location } from 'history';
import { debounce } from 'lodash';
import { type Subscription } from 'rxjs';
import * as z from 'zod';

import { locationService } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';
import { type AppChromeService, type AppChromeState } from 'app/core/components/AppChrome/AppChromeService';
import { isUrlRewrite } from 'app/core/navigation/urlRewrite';
import { contextSrv } from 'app/core/services/context_srv';

import { classifyPage, pageKey } from './classifyPage';
import { type PageHistoryEntry } from './types';

const STORAGE_SERVICE = 'grafana-page-history';
const PERSIST_MS = 1000;
export const PAGE_HISTORY_MAX = 100;
/** Serialized JSON length. Explore hrefs can be several KB each, so the count cap alone does not bound bytes. */
export const PAGE_HISTORY_MAX_BYTES = 200_000;
/** JS `Date` range; `formatDistanceToNowStrict` throws beyond it. */
const MAX_EPOCH_MS = 8.64e15;

/** Persisted row. The page identity is derived from the href on load, so a rule change reclassifies old rows. */
const StoredEntrySchema = z.object({
  href: z
    .string()
    .startsWith('/')
    .refine((href) => !href.startsWith('//')),
  lastVisited: z.number().int().min(0).max(MAX_EPOCH_MS),
  title: z.string().optional(),
});

type StoredEntry = z.infer<typeof StoredEntrySchema>;

function toStored({ href, lastVisited, title }: PageHistoryEntry): StoredEntry {
  return { href, lastVisited, title };
}

/** The page's own title, as the browser tab shows it; `undefined` until the page sets its nav after a route change. */
function pageTitle({ pageNav, sectionNav }: AppChromeState): string | undefined {
  if (pageNav?.text) {
    return pageNav.text;
  }
  // The route-change placeholder has an empty main section.
  return sectionNav.main.text ? sectionNav.node.text : undefined;
}

/** Per page, keeps the entry with the larger `lastVisited`; result is newest first. */
function mergeByPage(...lists: PageHistoryEntry[][]): PageHistoryEntry[] {
  const byKey = new Map<string, PageHistoryEntry>();
  for (const entry of lists.flat()) {
    const key = pageKey(entry);
    const current = byKey.get(key);
    if (!current || entry.lastVisited > current.lastVisited) {
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()].sort((a, b) => b.lastVisited - a.lastVisited);
}

/** Count cap, then byte budget on the stored form; always evicts the oldest (last) entries first. */
function capEntries(entries: PageHistoryEntry[]): PageHistoryEntry[] {
  const capped: PageHistoryEntry[] = [];
  // `[` and `]`, then one `,` per additional row: exactly JSON.stringify(rows).length.
  let bytes = 2;
  for (const entry of entries.slice(0, PAGE_HISTORY_MAX)) {
    bytes += JSON.stringify(toStored(entry)).length + (capped.length > 0 ? 1 : 0);
    if (bytes > PAGE_HISTORY_MAX_BYTES) {
      break;
    }
    capped.push(entry);
  }
  return capped;
}

/** Validates the stored copy row by row so one bad entry drops only itself. Rows that no longer classify are dropped. */
function parseEntries(raw: string | null): PageHistoryEntry[] {
  if (!raw) {
    return [];
  }
  let rows: unknown;
  try {
    rows = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) {
    return [];
  }

  const entries: PageHistoryEntry[] = [];
  for (const row of rows) {
    const result = StoredEntrySchema.safeParse(row);
    if (!result.success) {
      continue;
    }
    const page = classifyPage(new URL(result.data.href, 'http://localhost').pathname);
    if (page) {
      entries.push({ ...page, ...result.data });
    }
  }
  return capEntries(mergeByPage(entries));
}

/**
 * Records the pages the user visits (with their URL state) so the homepage can link back to them.
 * One list per user and org in `UserStorage`, which keeps anonymous users in localStorage.
 */
export class PageHistorySrv {
  /** Newest first by construction; `lastVisited` is only used for merging and display. */
  private entries: PageHistoryEntry[] = [];
  private currentPathname: string | undefined;
  /** Key of the recorded page the user is on; titles from the chrome are stamped onto it. */
  private currentKey: string | undefined;
  private readonly storage = new UserStorage(STORAGE_SERVICE);
  private readonly key = `org-${contextSrv.user.orgId}`;
  private ready: Promise<void> | undefined;
  private disposed = false;
  private unlisten: (() => void) | undefined;
  private chromeSubscription: Subscription | undefined;

  private persist = debounce(() => this.write(), PERSIST_MS);

  private onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      this.persist.flush();
    }
  };

  start(chrome: AppChromeService): void {
    if (this.ready) {
      return;
    }
    this.ready = this.load();

    // `history.listen` never emits the landing page.
    const location = locationService.getLocation();
    this.currentPathname = location.pathname;
    this.apply(location, true);

    this.unlisten = locationService.getHistory().listen((location, action) => {
      // Same rules as faroPageMeta: a flagged REPLACE is an in-place URL correction, not a navigation.
      const isRewrite = action === 'REPLACE' && isUrlRewrite(location.state);
      const isNavigation = !isRewrite && location.pathname !== this.currentPathname;
      this.currentPathname = location.pathname;
      this.apply(location, isNavigation);
    });
    // Pages set their nav after they render, so the title arrives after the navigation was recorded.
    this.chromeSubscription = chrome.state.subscribe((state) => this.setTitle(pageTitle(state)));
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  /** Newest first. Empty when recording was never started (feature off). */
  async getEntries(): Promise<PageHistoryEntry[]> {
    if (!this.ready) {
      return [];
    }
    await this.ready;
    return [...this.entries];
  }

  stop(): void {
    this.disposed = true;
    this.unlisten?.();
    this.unlisten = undefined;
    this.chromeSubscription?.unsubscribe();
    this.chromeSubscription = undefined;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.persist.cancel();
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

  private apply(location: Location, isNavigation: boolean): void {
    this.currentKey = undefined;
    const page = classifyPage(location.pathname);
    if (!page) {
      return;
    }

    const key = pageKey(page);
    const index = this.entries.findIndex((entry) => pageKey(entry) === key);
    // Churn or rewrite onto a page never navigated to (e.g. `/` → home dashboard rewrite).
    if (index === -1 && !isNavigation) {
      return;
    }
    const [existing] = index === -1 ? [] : this.entries.splice(index, 1);

    // Hash deliberately ignored. Query churn refreshes the href and moves the row to the top.
    this.entries.unshift({
      ...page,
      href: location.pathname + location.search,
      lastVisited: Date.now(),
      // Kept until the page sets its nav again, in case the user leaves before it does.
      title: existing?.title,
    });
    this.entries = capEntries(this.entries);
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
    if (this.disposed) {
      return;
    }
    try {
      await this.storage.setItem(this.key, JSON.stringify(this.entries.map(toStored)));
    } catch (e) {
      console.warn('Page history: save failed', e);
    }
  }
}

export const pageHistorySrv = new PageHistorySrv();
