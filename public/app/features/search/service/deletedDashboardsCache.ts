import { isResourceList } from 'app/features/apiserver/guards';
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

  clear(): void {
    this.cache = null;
    this.promise = null;
  }

  private async fetch(): Promise<SearchHit[]> {
    try {
      const api = getDashboardAPI();
      const deletedResponse = await api.listDeletedDashboards({ limit: 1000 });

      if (isResourceList<DashboardDataDTO>(deletedResponse)) {
        return resourceToSearchResult(deletedResponse);
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch deleted dashboards:', error);
      return [];
    }
  }
}

export const deletedDashboardsCache = new DeletedDashboardsCache();
