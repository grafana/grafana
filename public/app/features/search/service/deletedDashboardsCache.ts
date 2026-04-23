import { iamAPIv0alpha1 } from 'app/api/clients/iam/v0alpha1';
import { isResourceList } from 'app/features/apiserver/guards';
import { AnnoKeyUpdatedBy, type ResourceList } from 'app/features/apiserver/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { type DashboardDataDTO } from 'app/types/dashboard';
import { dispatch } from 'app/types/store';

import { type SearchHit } from './unified';
import { resourceToSearchResult } from './utils';

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
 * Resolves user display names for the `grafana.app/updatedBy` annotation on deleted dashboards.
 * Returns `undefined` when nothing to resolve or the lookup fails, in which case callers fall
 * back to rendering the raw annotation value.
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

  try {
    const response = await dispatch(iamAPIv0alpha1.endpoints.getDisplayMapping.initiate({ key: Array.from(uids) }));
    const displayList = response.data;
    if (!displayList) {
      return undefined;
    }
    const map = new Map<string, string>();
    for (const entry of displayList.display) {
      map.set(`${entry.identity.type}:${entry.identity.name}`, entry.displayName);
      if (entry.internalId !== undefined) {
        map.set(String(entry.internalId), entry.displayName);
        map.set(`${entry.identity.type}:${entry.internalId}`, entry.displayName);
      }
    }
    return map;
  } catch (error) {
    console.error('Failed to resolve deleted dashboard user displays:', error);
    return undefined;
  }
}
