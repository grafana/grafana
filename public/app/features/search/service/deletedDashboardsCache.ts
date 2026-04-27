import { iamAPIv0alpha1, type DisplayList } from 'app/api/clients/iam/v0alpha1';
import { isResourceList } from 'app/features/apiserver/guards';
import { AnnoKeyUpdatedBy, type ResourceList } from 'app/features/apiserver/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { type DashboardDataDTO } from 'app/types/dashboard';
import { dispatch } from 'app/types/store';

import { getMessageFromError } from '../../../core/utils/errors';

import { type SearchHit } from './unified';
import { DELETED_BY_REMOVED, DELETED_BY_UNKNOWN, resourceToSearchResult } from './utils';

/**
 * Caches the deleted-dashboards `ResourceList` and the resolved deleter display names.
 * `clear()` invalidates the list but keeps `displayNameCache` — display names are
 * identity-scoped, so Restore/Delete actions don't stale them.
 *
 * The `SearchHit[]` projection (`get()`) is computed per call — it's an O(items) loop
 * over the cached `ResourceList` + Map lookups, no network. This lets
 * `DELETED_BY_UNKNOWN` entries self-heal across calls when IAM retries succeed.
 */
class DeletedDashboardsCache {
  private resourceListCache: ResourceList<DashboardDataDTO> | null = null;
  private resourceListPromise: Promise<ResourceList<DashboardDataDTO>> | null = null;
  private displayNameCache: Map<string, string> = new Map();

  async get(): Promise<SearchHit[]> {
    const resourceList = await this.getAsResourceList();
    const uids = new Set<string>();
    for (const item of resourceList.items) {
      const uid = item.metadata.annotations?.[AnnoKeyUpdatedBy];
      if (uid) {
        uids.add(uid);
      }
    }
    const deletedByDisplayMap = await resolveDeletedByDisplayMap(uids, this.displayNameCache);
    return resourceToSearchResult(resourceList, deletedByDisplayMap);
  }

  async getAsResourceList(): Promise<ResourceList<DashboardDataDTO>> {
    if (this.resourceListCache !== null) {
      return this.resourceListCache;
    }

    if (this.resourceListPromise !== null) {
      return this.resourceListPromise;
    }

    this.resourceListPromise = this.fetchResourceList();

    try {
      this.resourceListCache = await this.resourceListPromise;
      return this.resourceListCache;
    } catch (error) {
      this.resourceListPromise = null;
      throw error;
    }
  }

  clear(): void {
    this.resourceListCache = null;
    this.resourceListPromise = null;
  }

  private async fetchResourceList(): Promise<ResourceList<DashboardDataDTO>> {
    try {
      const api = await getDashboardAPI();
      const deletedResponse = await api.listDeletedDashboards({ limit: 1000 });

      if (isResourceList<DashboardDataDTO>(deletedResponse)) {
        return deletedResponse;
      }

      return {
        apiVersion: 'v1',
        kind: 'List',
        metadata: { resourceVersion: '0' },
        items: [],
      };
    } catch (error) {
      console.error('Failed to fetch deleted dashboards:', error);
      return {
        apiVersion: 'v1',
        kind: 'List',
        metadata: { resourceVersion: '0' },
        items: [],
      };
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
 * Reuses `cache` to skip already-resolved UIDs and re-tries any cached as
 * `DELETED_BY_UNKNOWN`. Newly resolved entries are written back to `cache`.
 *
 * Returns a map keyed by every UID in `uids`. Each value is one of:
 *   - a real display name (IAM hit)
 *   - `DELETED_BY_REMOVED` (lookup succeeded, no entry — account was deleted)
 *   - `DELETED_BY_UNKNOWN` (batch failed)
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

  // Explicit type so TS picks the AppDispatch overload that preserves `.unsubscribe()`.
  type Subscription = ReturnType<ReturnType<typeof iamAPIv0alpha1.endpoints.getDisplayMapping.initiate>>;
  const subscriptions: Subscription[] = [];
  try {
    for (const keyBatch of batches) {
      subscriptions.push(
        dispatch(iamAPIv0alpha1.endpoints.getDisplayMapping.initiate({ key: keyBatch }, { subscribe: false }))
      );
    }
    const responses = await Promise.allSettled(subscriptions);

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
