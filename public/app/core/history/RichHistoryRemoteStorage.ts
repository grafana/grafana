import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import { RichHistoryQuery } from 'app/types/explore';

import { DataQuery } from '../../../../packages/grafana-data';
import { RichHistorySearchFilters, RichHistorySettings } from '../utils/richHistoryTypes';

import RichHistoryStorage, { RichHistoryStorageWarningDetails } from './RichHistoryStorage';
import { fromDTO } from './remoteStorageConverter';

export type RichHistoryRemoteStorageDTO = {
  uid: string;
  createdAt: number;
  datasourceUid: string;
  starred: boolean;
  comment: string;
  queries: DataQuery[];
};

export default class RichHistoryRemoteStorage implements RichHistoryStorage {
  async addToRichHistory(
    newRichHistoryQuery: Omit<RichHistoryQuery, 'id' | 'createdAt'>
  ): Promise<{ warning?: RichHistoryStorageWarningDetails; richHistoryQuery: RichHistoryQuery }> {
    const { result } = await getBackendSrv().post(`/api/query-history`, {
      dataSourceUid: newRichHistoryQuery.datasourceUid,
      queries: newRichHistoryQuery.queries,
    });
    return {
      richHistoryQuery: fromDTO(result),
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
    return (queryHistory.result.queryHistory || []).map(fromDTO);
  }

  async getSettings(): Promise<RichHistorySettings> {
    return {
      activeDatasourceOnly: false,
      lastUsedDatasourceFilters: undefined,
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
  let params = `${filters.datasourceFilters
    .map((datasourceName) => {
      const uid = getDataSourceSrv().getInstanceSettings(datasourceName)!.uid;
      return `datasourceUid=${encodeURIComponent(uid)}`;
    })
    .join('&')}`;
  if (filters.search) {
    params = params + `&searchString=${filters.search}`;
  }
  if (filters.sortOrder) {
    params = params + `&sort=${filters.sortOrder}`;
  }
  params = params + `&limit=100`;
  params = params + `&page=1`;
  if (filters.starred) {
    params = params + `&onlyStarred=${filters.starred}`;
  }
  return params;
}
