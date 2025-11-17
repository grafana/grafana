import { isResourceList } from 'app/features/apiserver/guards';
import { ResourceList } from 'app/features/apiserver/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { DashboardDataDTO } from 'app/types/dashboard';

import { SearchHit } from './unified';
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
      const api = getDashboardAPI();
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
    return resourceToSearchResult(resourceList);
  }
}

export const deletedDashboardsCache = new DeletedDashboardsCache();
