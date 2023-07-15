import { lastValueFrom } from 'rxjs';

import { DataQuery } from '@grafana/data';
import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import { RichHistoryQuery } from 'app/types/explore';

import { PreferencesService } from '../services/PreferencesService';
import { RichHistorySearchFilters, RichHistorySettings, SortOrder } from '../utils/richHistoryTypes';

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

type RichHistoryRemoteStorageResultsPayloadDTO = {
  result: {
    queryHistory: RichHistoryRemoteStorageDTO[];
    totalCount: number;
  };
};

type RichHistoryRemoteStorageUpdatePayloadDTO = {
  result: RichHistoryRemoteStorageDTO;
};

export default class RichHistoryRemoteStorage implements RichHistoryStorage {
  private readonly preferenceService: PreferencesService;

  constructor() {
    this.preferenceService = new PreferencesService('user');
  }

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
    getBackendSrv().delete(`/api/query-history/${id}`);
  }

  async getRichHistory(filters: RichHistorySearchFilters) {
    const params = buildQueryParams(filters);

    let requestId = 'query-history-get-all';

    if (filters.starred) {
      requestId = 'query-history-get-starred';
    }

    const queryHistory = await lastValueFrom(
      getBackendSrv().fetch<RichHistoryRemoteStorageResultsPayloadDTO>({
        method: 'GET',
        url: `/api/query-history?${params}`,
        // to ensure any previous requests are cancelled
        requestId,
      })
    );

    const data = queryHistory.data;
    const richHistory = (data.result.queryHistory || []).map(fromDTO);
    const total = data.result.totalCount || 0;

    return { richHistory, total };
  }

  async getSettings(): Promise<RichHistorySettings> {
    const preferences = await this.preferenceService.load();
    return {
      activeDatasourceOnly: false,
      lastUsedDatasourceFilters: undefined,
      retentionPeriod: 14,
      starredTabAsFirstTab: preferences.queryHistory?.homeTab === 'starred',
    };
  }

  async updateComment(id: string, comment: string | undefined): Promise<RichHistoryQuery> {
    const dto: RichHistoryRemoteStorageUpdatePayloadDTO = await getBackendSrv().patch(`/api/query-history/${id}`, {
      comment: comment,
    });
    return fromDTO(dto.result);
  }

  updateSettings(settings: RichHistorySettings): Promise<void> {
    return this.preferenceService.patch({
      queryHistory: {
        homeTab: settings.starredTabAsFirstTab ? 'starred' : 'query',
      },
    });
  }

  async updateStarred(id: string, starred: boolean): Promise<RichHistoryQuery> {
    let dto: RichHistoryRemoteStorageUpdatePayloadDTO;
    if (starred) {
      dto = await getBackendSrv().post(`/api/query-history/star/${id}`);
    } else {
      dto = await getBackendSrv().delete(`/api/query-history/star/${id}`);
    }
    return fromDTO(dto.result);
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
    params = params + `&sort=${filters.sortOrder === SortOrder.Ascending ? 'time-asc' : 'time-desc'}`;
  }
  if (!filters.starred) {
    const relativeFrom = filters.from === 0 ? 'now' : `now-${filters.from}d`;
    const relativeTo = filters.to === 0 ? 'now' : `now-${filters.to}d`;
    // TODO: Unify: remote storage from/to params are swapped comparing to frontend and local storage filters
    params = params + `&to=${relativeFrom}`;
    params = params + `&from=${relativeTo}`;
  }
  params = params + `&limit=100`;
  params = params + `&page=${filters.page || 1}`;
  if (filters.starred) {
    params = params + `&onlyStarred=${filters.starred}`;
  }
  return params;
}
