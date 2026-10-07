import { type Location } from 'history';
import { debounce } from 'lodash';
import * as z from 'zod';

import { store } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';
import { isUrlRewrite } from 'app/core/navigation/urlRewrite';
import { contextSrv } from 'app/core/services/context_srv';

import { classifyPage } from './classifyPage';
import { PAGE_HISTORY_KINDS, PAGE_HISTORY_MAX, type PageHistoryEntry } from './types';

const STORAGE_SERVICE = 'grafana-page-history';
const LOCAL_PERSIST_MS = 250;
const REMOTE_PERSIST_MS = 1000;
/** Serialized JSON length. Explore hrefs can be several KB each, so the count cap alone does not bound bytes. */
export const PAGE_HISTORY_MAX_BYTES = 200_000;
/** JS `Date` range; `formatDistanceToNowStrict` throws beyond it. */
const MAX_EPOCH_MS = 8.64e15;

const EntrySchema = z.object({
  key: z.string().min(1),
  kind: z.enum(PAGE_HISTORY_KINDS),
  href: z
    .string()
    .startsWith('/')
    .refine((href) => !href.startsWith('//')),
  lastVisited: z.number().int().min(0).max(MAX_EPOCH_MS),
  visits: z.number().int().positive(),
});

interface PendingEvent {
  location: Location;
  isNavigation: boolean;
  at: number;
}

/** Per key, keeps the entry with the larger `lastVisited`; result is newest first. */
function mergeByKey(...lists: PageHistoryEntry[][]): PageHistoryEntry[] {
  const byKey = new Map<string, PageHistoryEntry>();
  for (const entry of lists.flat()) {
    const current = byKey.get(entry.key);
    if (!current || entry.lastVisited > current.lastVisited) {
      byKey.set(entry.key, entry);
    }
  }
  return [...byKey.values()].sort((a, b) => b.lastVisited - a.lastVisited);
}

/** Count cap, then byte budget; always evicts the oldest (last) entries first. */
export function capEntries(entries: PageHistoryEntry[]): PageHistoryEntry[] {
  let capped = entries.slice(0, PAGE_HISTORY_MAX);
  while (capped.length > 0 && JSON.stringify(capped).length > PAGE_HISTORY_MAX_BYTES) {
    capped = capped.slice(0, -1);
  }
  return capped;
}

/**
 * Validates a stored copy row by row so one bad entry drops only itself. Rows whose href no longer
 * classifies to the stored kind/key (older rules, hand edits) are dropped too.
 */
export function parseEntries(raw: unknown): PageHistoryEntry[] {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) {
    return [];
  }

  const valid: PageHistoryEntry[] = [];
  for (const row of value) {
    const result = EntrySchema.safeParse(row);
    if (!result.success) {
      continue;
    }
    const entry = result.data;
    let pathname: string;
    try {
      pathname = new URL(entry.href, 'http://localhost').pathname;
    } catch {
      continue;
    }
    const page = classifyPage(pathname);
    if (page?.kind === entry.kind && page.key === entry.key) {
      valid.push(entry);
    }
  }
  return capEntries(mergeByKey(valid));
}

/**
 * Records the pages the user visits (with their URL state) so the homepage can link back to them.
 * Two copies of the same list: a localStorage mirror that survives tab close, and a best-effort
 * per-user server copy (`UserStorage`) for other browsers. Both are merged on load.
 */
export class PageHistorySrv {
  /** Newest first by construction; `lastVisited` is only used for merging and display. */
  private entries: PageHistoryEntry[] = [];
  private currentPathname: string | undefined;
  private storage: UserStorage | undefined;
  private localKey = '';
  private remoteKey = '';
  private ready: Promise<void> | undefined;
  private loaded = false;
  private disposed = false;
  private pending: PendingEvent[] = [];
  private unlisten: (() => void) | undefined;

  private persistLocal = debounce(() => this.writeLocal(), LOCAL_PERSIST_MS);
  private persistRemote = debounce(() => this.writeRemote(), REMOTE_PERSIST_MS);

  private onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      this.persistLocal.flush();
      this.persistRemote.flush();
    }
  };

  start(): void {
    if (this.ready) {
      return;
    }

    const user = config.bootData.user;
    // Same derivation as UserStorage so both copies key on the same user.
    const userUID = user.uid || String(user.id);
    this.remoteKey = `org-${contextSrv.user.orgId}`;
    this.localKey = `${STORAGE_SERVICE}:${userUID}:${this.remoteKey}:local`;
    this.storage = new UserStorage(STORAGE_SERVICE);
    this.ready = this.load();

    // `history.listen` never emits the landing page.
    const location = locationService.getLocation();
    this.currentPathname = location.pathname;
    this.record(location, true, Date.now());

    this.unlisten = locationService.getHistory().listen((location, action) => {
      // Same rules as faroPageMeta: a flagged REPLACE is an in-place URL correction, not a navigation.
      const isRewrite = action === 'REPLACE' && isUrlRewrite(location.state);
      const isNavigation = !isRewrite && location.pathname !== this.currentPathname;
      this.currentPathname = location.pathname;
      this.record(location, isNavigation, Date.now());
    });
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
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.persistLocal.cancel();
    this.persistRemote.cancel();
  }

  private record(location: Location, isNavigation: boolean, at: number): void {
    if (!this.loaded) {
      // Timestamp captured now so a replay after load keeps the real visit time.
      this.pending.push({ location, isNavigation, at });
      return;
    }
    this.apply(location, isNavigation, at);
  }

  private async load(): Promise<void> {
    let local: PageHistoryEntry[] = [];
    try {
      local = parseEntries(store.get(this.localKey));
    } catch (e) {
      console.warn('Page history: local load failed', e);
    }
    let remote: PageHistoryEntry[] = [];
    try {
      remote = parseEntries(await this.storage!.getItem(this.remoteKey));
    } catch (e) {
      console.warn('Page history: remote load failed', e);
    }

    // Also covers a failed UserStorage PATCH: it falls back to localStorage but keeps serving the
    // stale server cache, so the local mirror is the only place that write survives.
    this.entries = capEntries(mergeByKey(local, remote));
    this.loaded = true;

    const pending = this.pending;
    this.pending = [];
    if (this.disposed) {
      return;
    }
    for (const event of pending) {
      this.apply(event.location, event.isNavigation, event.at);
    }
  }

  private apply(location: Location, isNavigation: boolean, at: number): void {
    const page = classifyPage(location.pathname);
    if (!page) {
      return;
    }

    const index = this.entries.findIndex((entry) => entry.key === page.key);
    const existing = index === -1 ? undefined : this.entries[index];
    // Churn or rewrite onto a page never navigated to (e.g. `/` → home dashboard rewrite).
    if (!existing && !isNavigation) {
      return;
    }
    if (existing) {
      this.entries.splice(index, 1);
    }

    this.entries.unshift({
      key: page.key,
      kind: page.kind,
      // Hash deliberately ignored.
      href: location.pathname + location.search,
      // "Last interaction": query churn moves the row to the top; never goes backwards.
      lastVisited: Math.max(at, existing?.lastVisited ?? 0),
      visits: (existing?.visits ?? 0) + (isNavigation ? 1 : 0),
    });
    this.entries = capEntries(this.entries);
    this.persistLocal();
    this.persistRemote();
  }

  private writeLocal(): void {
    if (this.disposed) {
      return;
    }
    try {
      store.set(this.localKey, JSON.stringify(this.entries));
    } catch (e) {
      // Quota errors must not propagate into the history listener.
      console.warn('Page history: local save failed', e);
    }
  }

  private async writeRemote(): Promise<void> {
    if (this.disposed) {
      return;
    }
    try {
      await this.storage!.setItem(this.remoteKey, JSON.stringify(this.entries));
    } catch (e) {
      console.warn('Page history: remote save failed', e);
    }
  }
}

export const pageHistorySrv = new PageHistorySrv();
