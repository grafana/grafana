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
 * Store deleted dashboards in the cache to avoid multiple calls to the API.
 */
class DeletedDashboardsCache {
  private cache: SearchHit[] | null = null;
  private promise: Promise<SearchHit[]> | null = null;
  private resourceListCache: ResourceList<DashboardDataDTO> | null = null;
  private resourceListPromise: Promise<ResourceList<DashboardDataDTO>> | null = null;

  async get(): Promise<SearchHit[]> {
    if (this.cache !== null) {
      return this.cache;
    }

    if (this.promise !== null) {
      return this.promise;
    }

    this.promise = this.fetch();

    try {
      this.cache = await this.promise;
      return this.cache;
    } catch (error) {
      this.promise = null;
      throw error;
    }
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
    this.cache = null;
    this.promise = null;
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

      // Return empty ResourceList if not a valid ResourceList
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

  private async fetch(): Promise<SearchHit[]> {
    const resourceList = await this.getAsResourceList();
    const deletedByDisplayMap = await resolveDeletedByDisplayMap(resourceList);
    return resourceToSearchResult(resourceList, deletedByDisplayMap);
  }
}

export const deletedDashboardsCache = new DeletedDashboardsCache();

/**
 * Heuristic max UIDs per `getDisplayMapping` request. A typical `user:<uid>` key is ~27 bytes
 * URL-encoded (`&key=user:xxxxxxxxxxxxxx`); at 200 keys the query string stays well under nginx's
 * default 8 KB `client_header_buffer_size`. Tune down if proxies enforce smaller header limits.
 */
const IAM_DISPLAY_BATCH_SIZE = 200;

/**
 * Resolves user display names for the `grafana.app/updatedBy` annotation on deleted dashboards.
 *
 * Returns `undefined` only when there is nothing to resolve (no annotated items). Otherwise
 * returns a map whose value for every requested UID is one of:
 *   - a real display name (IAM lookup hit)
 *   - `DELETED_BY_REMOVED` (successful batch, no entry for this UID — account was deleted)
 *   - `DELETED_BY_UNKNOWN` (batch for this UID failed)
 *
 * Callers can therefore do a single `map.get(uid)` lookup with no fallback interpretation.
 */
export async function resolveDeletedByDisplayMap(
  resourceList: ResourceList<DashboardDataDTO>
): Promise<Map<string, string> | undefined> {
  const uids = new Set<string>();
  for (const item of resourceList.items) {
    const uid = item.metadata.annotations?.[AnnoKeyUpdatedBy];
    if (uid) {
      uids.add(uid);
    }
  }
  if (uids.size === 0) {
    return undefined;
  }

  // Sort for stable cache keys across equivalent UID sets arriving in different order.
  const keys = Array.from(uids).sort();
  const batches: string[][] = [];
  for (let i = 0; i < keys.length; i += IAM_DISPLAY_BATCH_SIZE) {
    batches.push(keys.slice(i, i + IAM_DISPLAY_BATCH_SIZE));
  }

  // `dispatch(initiate(...))` returns RTK Query's `QueryActionCreatorResult` (thenable +
  // `.unsubscribe()`). Explicitly typing the array lets TS pick the right `AppDispatch` overload,
  // which otherwise collapses to `AnyAction` and loses `.unsubscribe()`.
  type Subscription = ReturnType<ReturnType<typeof iamAPIv0alpha1.endpoints.getDisplayMapping.initiate>>;
  const subscriptions: Subscription[] = [];
  try {
    for (const keyBatch of batches) {
      // One-shot lookups: avoid registering RTK Query subscriptions so cache entries aren't kept
      // alive across rebuilds (each rebuild passes a different `key` array). Pushing inside the
      // `try` guarantees `finally` unsubscribes whatever was created before any synchronous throw.
      subscriptions.push(
        dispatch(iamAPIv0alpha1.endpoints.getDisplayMapping.initiate({ key: keyBatch }, { subscribe: false }))
      );
    }
    const responses = await Promise.allSettled(subscriptions);

    // Seed every requested UID with DELETED_BY_REMOVED; we overwrite below with the real display
    // name when the batch returned one, or with DELETED_BY_UNKNOWN when the batch failed.
    const map = new Map<string, string>();
    for (const uid of keys) {
      map.set(uid, DELETED_BY_REMOVED);
    }

    for (let i = 0; i < responses.length; i++) {
      const displayList = extractDisplayData(responses[i]);
      if (!displayList) {
        for (const key of batches[i]) {
          map.set(key, DELETED_BY_UNKNOWN);
        }
        continue;
      }
      for (const entry of displayList.display) {
        map.set(`${entry.identity.type}:${entry.identity.name}`, entry.displayName);
        if (entry.internalId !== undefined) {
          map.set(String(entry.internalId), entry.displayName);
          map.set(`${entry.identity.type}:${entry.internalId}`, entry.displayName);
        }
      }
    }
    return map;
  } catch (error) {
    // Defensive: `Promise.allSettled` does not reject, so this only catches synchronous throws
    // from `dispatch()` itself. Return an all-unknown map so callers still render consistent
    // placeholders rather than raw UIDs.
    console.error('Failed to resolve deleted dashboard user displays:', getMessageFromError(error));
    const map = new Map<string, string>();
    for (const uid of keys) {
      map.set(uid, DELETED_BY_UNKNOWN);
    }
    return map;
  } finally {
    for (const sub of subscriptions) {
      sub.unsubscribe();
    }
  }
}

/**
 * Normalizes a single batch's settled result into either a `DisplayList` (success) or
 * `undefined` (failure, already logged). Keeps `resolveDeletedByDisplayMap` free of nested
 * ternaries and routes all error messages through `getMessageFromError` for consistency.
 */
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
