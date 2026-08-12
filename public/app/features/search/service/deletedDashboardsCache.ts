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

import { getMessageFromError } from '../../../core/utils/errors';

import { type SearchHit } from './unified';
import { DELETED_BY_REMOVED, DELETED_BY_UNKNOWN } from './utils';

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

  clear(): void {
    this.tableCache = null;
    this.tablePromise = null;
  }

  removeItems(uids: string[]): void {
    if (!this.tableCache) {
      return;
    }
    const uidSet = new Set(uids);
    this.tableCache = {
      ...this.tableCache,
      rows: this.tableCache.rows.filter((row) => !uidSet.has(row.object.metadata.name)),
    };
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
