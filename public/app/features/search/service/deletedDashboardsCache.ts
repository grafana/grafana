import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { iamAPIv0alpha1, type DisplayList } from 'app/api/clients/iam/v0alpha1';
import {
  AnnoKeyFolder,
  AnnoKeyUpdatedBy,
  EMPTY_TABLE_RESPONSE,
  type TableResponse,
  type TableRow,
} from 'app/features/apiserver/types';
import { DELETED_DASHBOARDS_LIMIT } from 'app/features/browse-dashboards/components/DeletedDashboardsLimitBanner';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { dispatch } from 'app/types/store';

import { getMessageFromError, getStatusFromError } from '../../../core/utils/errors';

import {
  fetchTrashPage,
  TRASH_FIELD_DELETED_BY,
  TRASH_FIELD_DELETION_TIME,
  TRASH_FIELD_FOLDER,
  TRASH_FIELD_TAGS,
  TRASH_FIELD_TITLE,
  type SortField,
  type TrashItem,
  type TrashQuery,
  type WhereNode,
} from './trashSearchApi';
import { type SearchHit } from './unified';
import { DELETED_BY_REMOVED, DELETED_BY_UNKNOWN, filterSearchResults } from './utils';

/**
 * The query the Recently deleted page can express, whichever backend serves it.
 *
 * `tags` rather than `tag`, because that is what the search state manager puts in a SearchQuery.
 */
interface DeletedDashboardsQuery {
  query?: string;
  tags?: string[];
  sort?: string;
}

/**
 * Server page size. The endpoint caps a page at 500, so asking for more just gets clamped.
 * Pages are followed up to DELETED_DASHBOARDS_LIMIT rows.
 */
const TRASH_PAGE_SIZE = 500;

/**
 * Ceiling on how many requests one query may make. Rows fetched cannot bound the loop on its
 * own: the endpoint is allowed to answer a short or empty page and still hand back a token, so
 * a token that never clears would otherwise keep the loop going. Two pages cover the row
 * ceiling; the rest is room for short pages.
 */
const MAX_TRASH_PAGES = 8;

/**
 * Outcome of one trash fetch. Failure is distinguished from an empty result because the two
 * mean opposite things to the page, and `unavailable` separates the failure the server tells
 * us about from every other one.
 */
type TrashFetchResult =
  | { failed: false; items: TrashItem[]; truncated: boolean }
  | { failed: true; unavailable: boolean };

/**
 * The UI's sort values mapped onto trash fields. `deletedby-*` sorts on the deleter's UID
 * rather than their display name, because the name is resolved in the browser and the server
 * has never seen it.
 */
const TRASH_SORT_FIELDS: Record<string, SortField> = {
  'alpha-asc': { field: TRASH_FIELD_TITLE, direction: 'asc' },
  'alpha-desc': { field: TRASH_FIELD_TITLE, direction: 'desc' },
  'deleted-asc': { field: TRASH_FIELD_DELETION_TIME, direction: 'asc' },
  'deleted-desc': { field: TRASH_FIELD_DELETION_TIME, direction: 'desc' },
  'deletedby-asc': { field: TRASH_FIELD_DELETED_BY, direction: 'asc' },
  'deletedby-desc': { field: TRASH_FIELD_DELETED_BY, direction: 'desc' },
};

// Evaluated per call rather than held: the flag's value can change under a running page.
function isTrashEnabled(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.DashboardRecentlyDeletedViaTrash, false);
}

/**
 * The fields to ask for. The server's default set omits tags, and naming any field replaces
 * that default, so every field the UI reads has to be listed. `deleted_rv` is appended by the
 * server whatever we ask for.
 */
const TRASH_RETURN_FIELDS = [
  TRASH_FIELD_TITLE,
  TRASH_FIELD_FOLDER,
  TRASH_FIELD_TAGS,
  TRASH_FIELD_DELETED_BY,
  TRASH_FIELD_DELETION_TIME,
];

/** Builds the request body for one page of a Recently deleted query. */
function buildTrashQuery(query: DeletedDashboardsQuery, continueToken: string | undefined, limit: number): TrashQuery {
  // "*" is how the page spells "everything", but the endpoint would treat it as a literal.
  const text = query.query?.trim();
  const sort = query.sort ? TRASH_SORT_FIELDS[query.sort] : undefined;

  const leaves: WhereNode[] = [];
  if (text && text !== '*') {
    leaves.push({ text: { value: text, fields: [TRASH_FIELD_TITLE] } });
  }
  // One leaf per tag, not one leaf listing them all: In matches any of its values, and tag
  // filters elsewhere in Grafana require every selected tag. Leaves are ANDed, so a leaf each
  // is what makes two tags mean both.
  for (const tag of query.tags ?? []) {
    leaves.push({ filter: { field: TRASH_FIELD_TAGS, operator: 'In', values: [tag] } });
  }

  // The endpoint takes a single leaf or a single `and` of leaves, so only wrap when there are two.
  const where = leaves.length === 1 ? leaves[0] : leaves.length > 1 ? { and: leaves } : undefined;

  return {
    ...(where ? { where } : {}),
    ...(sort ? { sort: [sort] } : {}),
    fields: TRASH_RETURN_FIELDS,
    limit: Math.min(limit, TRASH_PAGE_SIZE),
    ...(continueToken ? { continue: continueToken } : {}),
  };
}

/**
 * Caches the deleted-dashboards `TableResponse` and the resolved deleter display names.
 * `clear()` invalidates the table but keeps `displayNameCache` — display names are
 * identity-scoped, so Restore/Delete actions don't stale them.
 *
 * The `SearchHit[]` projection (`get()`) is computed per call — it's an O(rows) loop
 * over the cached `TableResponse` + Map lookups, no network. This lets
 * `DELETED_BY_UNKNOWN` entries self-heal across calls when IAM retries succeed.
 */
class DeletedDashboardsCache {
  private tableCache: TableResponse | null = null;
  private tablePromise: Promise<TableResponse> | null = null;
  private displayNameCache: Map<string, string> = new Map();
  /**
   * In-flight or settled trash fetch per query, since the server does the filtering and each
   * query is its own list. The promise is stored at request start, not the resolved rows, so
   * concurrent identical queries share one fetch and a `clear()` mid-fetch cannot be undone by
   * a late write.
   */
  private trashCache: Map<string, Promise<TrashFetchResult>> = new Map();
  /** Dashboards restored this session. The trash index may still list them for a moment. */
  private restoredUids: Set<string> = new Set();
  /** Set when the server says trash exists but cannot be served yet. */
  private trashUnavailable = false;
  /** Set when the fetch stopped at the row ceiling with more still available. */
  private trashTruncated = false;

  /**
   * The deleted dashboards matching `query`, already filtered and sorted.
   *
   * With the flag off the whole list is fetched and the browser filters it. With the flag on
   * the server does both, so the two paths can return different sets — see the feature flag's
   * description.
   */
  async search(query: DeletedDashboardsQuery): Promise<SearchHit[]> {
    if (!isTrashEnabled()) {
      return filterSearchResults(await this.get(), query);
    }
    return this.searchTrash(query);
  }

  /**
   * Every deleted dashboard, for building the tag filter's options.
   *
   * Separate from `search` because it asks a different question from the one the page is showing,
   * and the banner reads state that `search` maintains. Filling a dropdown must not change what
   * the page says about its own results.
   */
  async searchAllForOptions(): Promise<SearchHit[]> {
    if (!isTrashEnabled()) {
      return this.get();
    }
    return this.searchTrash({}, { reportState: false });
  }

  async get(): Promise<SearchHit[]> {
    const table = await this.getAsTable();
    const uids = new Set<string>();
    for (const row of table.rows) {
      const uid = row.object.metadata.annotations?.[AnnoKeyUpdatedBy];
      if (uid) {
        uids.add(uid);
      }
    }
    const deletedByDisplayMap = await resolveDeletedByDisplayMap(uids, this.displayNameCache);
    return tableToSearchResult(table, deletedByDisplayMap);
  }

  async getAsTable(): Promise<TableResponse> {
    if (this.tableCache !== null) {
      return this.tableCache;
    }

    if (this.tablePromise !== null) {
      return this.tablePromise;
    }

    this.tablePromise = this.fetchTable();

    try {
      this.tableCache = await this.tablePromise;
      return this.tableCache;
    } catch (error) {
      this.tablePromise = null;
      throw error;
    }
  }

  /**
   * Whether the last trash fetch failed because the server cannot serve trash yet, rather than
   * because nothing is deleted. The two are otherwise indistinguishable to the user.
   */
  isTrashUnavailable(): boolean {
    return this.trashUnavailable;
  }

  /**
   * Whether the last trash fetch stopped at DELETED_DASHBOARDS_LIMIT while the server still had
   * more to give, so the list on screen is not everything that matches.
   */
  isTrashTruncated(): boolean {
    return this.trashTruncated;
  }

  clear(): void {
    this.tableCache = null;
    this.tablePromise = null;
    this.trashCache.clear();
    this.trashUnavailable = false;
    this.trashTruncated = false;
    // Deleting a dashboard clears the cache, and a dashboard restored earlier may be among
    // the deleted ones again, so the suppression list must not outlive the cached results.
    this.restoredUids.clear();
  }

  removeItems(uids: string[]): void {
    for (const uid of uids) {
      this.restoredUids.add(uid);
    }

    if (!this.tableCache) {
      return;
    }
    const uidSet = new Set(uids);
    this.tableCache = {
      ...this.tableCache,
      rows: this.tableCache.rows.filter((row) => !uidSet.has(row.object.metadata.name)),
    };
  }

  private async searchTrash(
    query: DeletedDashboardsQuery,
    { reportState = true }: { reportState?: boolean } = {}
  ): Promise<SearchHit[]> {
    // Every part of the query the server sees belongs in the key. Leaving one out serves a
    // result for a different query, which looks exactly like the filter being ignored. Tags are
    // sorted so the same set picked in a different order shares one entry.
    const key = JSON.stringify({
      query: query.query ?? '',
      sort: query.sort ?? '',
      tags: [...(query.tags ?? [])].sort(),
    });

    let pending = this.trashCache.get(key);
    if (!pending) {
      pending = this.fetchTrash(query);
      this.trashCache.set(key, pending);
    }

    const result = await pending;

    // Everything the cache carries between calls is written only by the fetch that is still the
    // current one for this query. A slower, superseded fetch must not clear a warning the page
    // is showing, or raise one for results nobody is looking at any more.
    const isCurrent = this.trashCache.get(key) === pending;

    if (result.failed) {
      if (isCurrent) {
        // A failure is not cached: an index being rebuilt becomes available on its own, and
        // keeping the empty list would leave the page stuck until the next delete or restore.
        this.trashCache.delete(key);
      }
      if (isCurrent && reportState) {
        this.trashUnavailable = result.unavailable;
        // There is no list, so nothing was left out of one.
        this.trashTruncated = false;
      }
      return [];
    }

    if (isCurrent && reportState) {
      this.trashUnavailable = false;
      this.trashTruncated = result.truncated;
    }

    const items = result.items;
    const uids = new Set<string>();
    for (const item of items) {
      const uid = readString(item, TRASH_FIELD_DELETED_BY);
      if (uid) {
        uids.add(uid);
      }
    }
    // Resolved per call, not cached with the items, so DELETED_BY_UNKNOWN entries recover
    // once an IAM lookup succeeds.
    const deletedByDisplayMap = await resolveDeletedByDisplayMap(uids, this.displayNameCache);

    return items
      .filter((item) => !this.restoredUids.has(item.resource.name))
      .map((item) => trashItemToSearchResult(item, deletedByDisplayMap));
  }

  /**
   * Follows `continue` until the result set is exhausted or DELETED_DASHBOARDS_LIMIT rows are in
   * hand. Reports failure rather than an empty list, which the caller must not confuse with a
   * query that matched nothing.
   */
  private async fetchTrash(query: DeletedDashboardsQuery): Promise<TrashFetchResult> {
    try {
      const items: TrashItem[] = [];
      let continueToken: string | undefined;
      let pages = 0;

      do {
        const response = await fetchTrashPage(
          buildTrashQuery(query, continueToken, DELETED_DASHBOARDS_LIMIT - items.length)
        );
        items.push(...(response.items ?? []));
        continueToken = response.metadata?.continue;
        pages++;
      } while (items.length < DELETED_DASHBOARDS_LIMIT && continueToken && pages < MAX_TRASH_PAGES);

      // Only the row ceiling is reported, because that is the number the banner names. Stopping
      // at the page cap also leaves rows behind, but saying "limited to 1000" would be wrong when
      // far fewer came back.
      const truncated = items.length >= DELETED_DASHBOARDS_LIMIT && Boolean(continueToken);
      return { failed: false, items, truncated };
    } catch (error) {
      // 503 is the one failure the server distinguishes for us: trash is on, but this index
      // has not been rebuilt to hold deleted documents. Anything else, including a server
      // that does not serve the endpoint at all, reads as an empty list.
      console.error('Failed to fetch deleted dashboards from the trash endpoint:', error);
      return { failed: true, unavailable: getStatusFromError(error) === 503 };
    }
  }

  private async fetchTable(): Promise<TableResponse> {
    try {
      const api = await getDashboardAPI();
      // The backend may return multiple soft-deleted versions of the same dashboard
      // after restore+re-delete cycles. Dedup by UID as we page so the limit counts
      // unique dashboards, keeping the newest resourceVersion per UID.
      const deduped = new Map<string, TableRow>();
      let continueToken: string | undefined;
      let lastResponse: TableResponse | undefined;

      do {
        const response = await api.listDeletedDashboards({
          limit: DELETED_DASHBOARDS_LIMIT - deduped.size,
          continue: continueToken,
        });

        if (!response.rows) {
          break;
        }

        for (const row of response.rows) {
          const uid = row.object.metadata.name;
          const existing = deduped.get(uid);
          if (
            !existing ||
            (row.object.metadata.resourceVersion ?? '') > (existing.object.metadata.resourceVersion ?? '')
          ) {
            deduped.set(uid, row);
          }
        }

        continueToken = response.metadata.continue;
        lastResponse = response;
      } while (deduped.size < DELETED_DASHBOARDS_LIMIT && continueToken);

      if (!lastResponse) {
        return EMPTY_TABLE_RESPONSE;
      }

      return {
        ...lastResponse,
        metadata: { ...lastResponse.metadata, continue: continueToken },
        rows: Array.from(deduped.values()),
      };
    } catch (error) {
      console.error('Failed to fetch deleted dashboards:', error);
      return EMPTY_TABLE_RESPONSE;
    }
  }
}

export const deletedDashboardsCache = new DeletedDashboardsCache();

/**
 * Max UIDs per `getDisplayMapping` request. Keeps the URL well under nginx's default
 * 8 KB `client_header_buffer_size` (~27 bytes per `&key=user:<uid>`).
 */
const IAM_DISPLAY_BATCH_SIZE = 200;

/**
 * Resolves display names for `uids` in batches of `IAM_DISPLAY_BATCH_SIZE`.
 *
 * Entries already present in `cache` are skipped.  Successful lookups are
 * written into `cache` so that future calls for the same UIDs are free.
 *
 * **Failed batches**: UIDs belonging to a batch that failed (network / 5xx)
 * are **not** written into the cache.  The next call to `get()` will retry
 * them while still reading any previously resolved UIDs from the cache.
 * This means transient IAM failures are self-healing without needing a full
 * cache clear.
 */
export async function resolveDeletedByDisplayMap(
  uids: Set<string>,
  cache: Map<string, string>
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const toFetch = new Set<string>();
  for (const uid of uids) {
    const cached = cache.get(uid);
    // Re-fetch UIDs whose previous lookup failed transiently — DELETED_BY_REMOVED is terminal.
    if (cached !== undefined && cached !== DELETED_BY_UNKNOWN) {
      result.set(uid, cached);
    } else {
      toFetch.add(uid);
    }
  }

  if (toFetch.size === 0) {
    return result;
  }

  // Sort for stable cache keys across equivalent UID sets arriving in different order.
  const keys = Array.from(toFetch).sort();
  const batches: string[][] = [];
  for (let i = 0; i < keys.length; i += IAM_DISPLAY_BATCH_SIZE) {
    batches.push(keys.slice(i, i + IAM_DISPLAY_BATCH_SIZE));
  }

  const promises = [];
  try {
    for (const keyBatch of batches) {
      promises.push(
        dispatch(iamAPIv0alpha1.endpoints.getDisplayMapping.initiate({ key: keyBatch }, { subscribe: false }))
      );
    }
    const responses = await Promise.allSettled(promises);

    const fetched = new Map<string, string>();
    for (const uid of keys) {
      fetched.set(uid, DELETED_BY_REMOVED);
    }

    for (let i = 0; i < responses.length; i++) {
      const displayList = extractDisplayData(responses[i]);
      if (!displayList) {
        for (const key of batches[i]) {
          fetched.set(key, DELETED_BY_UNKNOWN);
        }
        continue;
      }
      for (const entry of displayList.display) {
        fetched.set(`${entry.identity.type}:${entry.identity.name}`, entry.displayName);
        if (entry.internalId !== undefined) {
          fetched.set(String(entry.internalId), entry.displayName);
          fetched.set(`${entry.identity.type}:${entry.internalId}`, entry.displayName);
        }
      }
    }

    for (const [uid, display] of fetched) {
      cache.set(uid, display);
    }
    for (const uid of toFetch) {
      const value = fetched.get(uid);
      if (value !== undefined) {
        result.set(uid, value);
      }
    }
    return result;
  } catch (error) {
    // `Promise.allSettled` cannot reject; this catches synchronous throws from `dispatch()`
    // itself. Mark every UID unknown so callers render placeholders, not raw UIDs.
    console.error('Failed to resolve deleted dashboard user displays:', getMessageFromError(error));
    for (const uid of toFetch) {
      result.set(uid, DELETED_BY_UNKNOWN);
    }
    return result;
  }
}

/** Returns the `DisplayList` on success, or `undefined` after logging on failure. */
function extractDisplayData(
  settled: PromiseSettledResult<{ data?: DisplayList; error?: unknown }>
): DisplayList | undefined {
  if (settled.status === 'rejected') {
    console.error('Failed to resolve deleted dashboard user displays:', getMessageFromError(settled.reason));
    return undefined;
  }
  // RTK Query query thunks resolve (do not reject) on request errors — surface them explicitly.
  if (settled.value.error) {
    console.error('Failed to resolve deleted dashboard user displays:', getMessageFromError(settled.value.error));
    return undefined;
  }
  return settled.value.data;
}

/**
 * Converts a Table response to SearchHit[] for the deleted dashboards view.
 * Column indices are resolved by name from `columnDefinitions` — order is not guaranteed
 * across API versions.
 */
function tableToSearchResult(table: TableResponse, deletedByDisplayMap?: Map<string, string>): SearchHit[] {
  const titleIdx = table.columnDefinitions.findIndex((c) => c.name.toLowerCase() === 'title');
  const tagsIdx = table.columnDefinitions.findIndex((c) => c.name.toLowerCase() === 'tags');

  return table.rows.map((row) => {
    const meta = row.object.metadata;
    const field: Record<string, string | number> = {};
    if (meta.deletionTimestamp) {
      field.deletionTimestamp = meta.deletionTimestamp;
    }
    const deletedByUid = meta.annotations?.[AnnoKeyUpdatedBy];
    if (deletedByUid) {
      field.deletedBy = deletedByDisplayMap?.get(deletedByUid) ?? DELETED_BY_UNKNOWN;
    }

    const folder = meta.annotations?.[AnnoKeyFolder] ?? 'general';

    return {
      resource: 'dashboards',
      name: meta.name,
      title: titleIdx >= 0 ? String(row.cells[titleIdx] ?? '') : '',
      location: folder || 'general',
      folder: folder || 'general',
      tags: tagsIdx >= 0 && Array.isArray(row.cells[tagsIdx]) ? row.cells[tagsIdx] : [],
      field,
      url: '',
    };
  });
}

/** Reads one string field off a trash item. Absent fields are omitted by the server. */
function readString(item: TrashItem, name: string): string | undefined {
  const value = item.fields?.[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** Converts a trash result item to the SearchHit shape the deleted dashboards view renders. */
function trashItemToSearchResult(item: TrashItem, deletedByDisplayMap: Map<string, string>): SearchHit {
  const field: Record<string, string | number> = {};

  // The endpoint reports the deletion time as unix millis; the rest of the UI expects the
  // same ISO string the object metadata carries.
  const deletionTime = item.fields?.[TRASH_FIELD_DELETION_TIME];
  if (typeof deletionTime === 'number') {
    field.deletionTimestamp = new Date(deletionTime).toISOString();
  }

  const deletedByUid = readString(item, TRASH_FIELD_DELETED_BY);
  if (deletedByUid) {
    field.deletedBy = deletedByDisplayMap.get(deletedByUid) ?? DELETED_BY_UNKNOWN;
  }

  const folder = readString(item, TRASH_FIELD_FOLDER) ?? 'general';
  const tags = item.fields?.[TRASH_FIELD_TAGS];

  return {
    resource: 'dashboards',
    name: item.resource.name,
    title: readString(item, TRASH_FIELD_TITLE) ?? '',
    folder,
    tags: Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : [],
    field,
    url: '',
  };
}
