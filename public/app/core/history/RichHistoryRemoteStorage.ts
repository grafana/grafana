import { RichHistoryQuery } from 'app/types/explore';
import RichHistoryStorage, { RichHistoryStorageWarningDetails } from './RichHistoryStorage';
import { RichHistorySearchFilters, RichHistorySettings } from '../utils/richHistoryTypes';
import { getBackendSrv } from '@grafana/runtime';

export default class RichHistoryRemoteStorage implements RichHistoryStorage {
  async addToRichHistory(
    newRichHistoryQuery: Omit<RichHistoryQuery, 'id' | 'createdAt'>
  ): Promise<{ warning?: RichHistoryStorageWarningDetails; richHistoryQuery: RichHistoryQuery }> {
    const { result } = await getBackendSrv().post(`/api/query-history`, {
      dataSourceUid: newRichHistoryQuery.datasourceUid,
      queries: newRichHistoryQuery.queries,
    });
    return {
      richHistoryQuery: result,
    };
  }

  async deleteAll(): Promise<void> {
    throw new Error('not supported');
  }

  async deleteRichHistory(id: string): Promise<void> {
    throw new Error('not supported yet');
  }

  async getRichHistory(filters: RichHistorySearchFilters): Promise<RichHistoryQuery[]> {
    const params = buildQueryParams(filters);
    const queryHistory = await getBackendSrv().get(`/api/query-history?${params}`);
    return queryHistory.result.queryHistory || [];
  }

  async getSettings(): Promise<RichHistorySettings> {
    return {
      activeDatasourceOnly: false,
      lastUsedDatasourceFilters: undefined,
      // PLAN 5: what about filtering from and to?
      retentionPeriod: 14,
      starredTabAsFirstTab: false,
    };
  }

  async updateComment(id: string, comment: string | undefined): Promise<RichHistoryQuery> {
    throw new Error('not supported yet');
  }

  async updateSettings(settings: RichHistorySettings): Promise<void> {
    throw new Error('not supported yet');
  }

  async updateStarred(id: string, starred: boolean): Promise<RichHistoryQuery> {
    throw new Error('not supported yet');
  }
}

function buildQueryParams(filters: RichHistorySearchFilters): string {
  let params = `${filters.datasourceFilters.map((uid) => `datasourceUid=${encodeURIComponent(uid)}`).join('&')}`;
  if (filters.search) {
    params = params + `&searchString=${filters.search}`;
  }
  if (filters.sortOrder) {
    params = params + `&sort=${filters.sortOrder}`;
  }
  // PLAN 4: support for pagination
  params = params + `&limit=10`;
  params = params + `&page=1`;
  if (filters.starred) {
    params = params + `&onlyStarred=${filters.starred}`;
  }
  return params;
}
