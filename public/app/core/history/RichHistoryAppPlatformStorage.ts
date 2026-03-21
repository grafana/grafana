import { lastValueFrom } from 'rxjs';

import { DataQuery } from '@grafana/data';
import { getBackendSrv, getDataSourceSrv, config } from '@grafana/runtime';
import { RichHistoryQuery } from 'app/types/explore';

import { PreferencesService } from '../services/PreferencesService';
import { RichHistorySearchBackendFilters, RichHistorySettings, SortOrder } from '../utils/richHistoryTypes';

import RichHistoryStorage, { RichHistoryResults, RichHistoryStorageWarningDetails } from './RichHistoryStorage';

const API_BASE = `/apis/queryhistory.grafana.app/v0alpha1/namespaces`;

type K8sQueryHistoryResource = {
  metadata: {
    name: string;
    creationTimestamp: string;
  };
  spec: {
    datasourceUid: string;
    queries: DataQuery[];
    comment?: string;
  };
};

type K8sListResponse = {
  items: K8sQueryHistoryResource[];
};

type SearchResponse = {
  items: Array<{
    uid: string;
    datasourceUid: string;
    createdAt: number;
    comment: string;
    queries: DataQuery[];
    starred: boolean;
  }>;
  totalCount?: number;
};

export default class RichHistoryAppPlatformStorage implements RichHistoryStorage {
  private readonly preferenceService: PreferencesService;
  private readonly namespace: string;

  constructor() {
    this.preferenceService = new PreferencesService('user');
    this.namespace = config.namespace || 'default';
  }

  private get queryHistoriesUrl(): string {
    return `${API_BASE}/${this.namespace}/queryhistories`;
  }

  async addToRichHistory(
    newRichHistoryQuery: Omit<RichHistoryQuery, 'id' | 'createdAt'>
  ): Promise<{ warning?: RichHistoryStorageWarningDetails; richHistoryQuery: RichHistoryQuery }> {
    const result: K8sQueryHistoryResource = await getBackendSrv().post(this.queryHistoriesUrl, {
      apiVersion: 'queryhistory.grafana.app/v0alpha1',
      kind: 'QueryHistory',
      spec: {
        datasourceUid: newRichHistoryQuery.datasourceUid,
        queries: newRichHistoryQuery.queries,
      },
    });

    return {
      richHistoryQuery: this.fromK8sResource(result),
    };
  }

  async deleteAll(): Promise<void> {
    throw new Error('not supported');
  }

  async deleteRichHistory(id: string): Promise<void> {
    await getBackendSrv().delete(`${this.queryHistoriesUrl}/${id}`);
  }

  async getRichHistory(filters: RichHistorySearchBackendFilters): Promise<RichHistoryResults> {
    const params = this.buildSearchParams(filters);
    const requestId = filters.starred ? 'query-history-get-starred' : 'query-history-get-all';

    // Try search endpoint first, fall back to list
    try {
      const response = await lastValueFrom(
        getBackendSrv().fetch<SearchResponse>({
          method: 'GET',
          url: `${this.queryHistoriesUrl}/search?${params}`,
          requestId,
        })
      );

      const items = (response.data.items || []).map((item) => ({
        id: item.uid,
        createdAt: item.createdAt,
        datasourceName: getDataSourceSrv().getInstanceSettings({ uid: item.datasourceUid })?.name || '',
        datasourceUid: item.datasourceUid,
        starred: item.starred,
        comment: item.comment || '',
        queries: item.queries || [],
      }));

      return { richHistory: items, total: response.data.totalCount };
    } catch {
      // Fall back to k8s list endpoint
      const response = await lastValueFrom(
        getBackendSrv().fetch<K8sListResponse>({
          method: 'GET',
          url: this.queryHistoriesUrl,
          requestId,
        })
      );

      const items = (response.data.items || []).map((item) => this.fromK8sResource(item));
      return { richHistory: items, total: items.length };
    }
  }

  async updateComment(id: string, comment: string | undefined): Promise<RichHistoryQuery> {
    const current: K8sQueryHistoryResource = await getBackendSrv().get(`${this.queryHistoriesUrl}/${id}`);
    current.spec.comment = comment || '';

    const result: K8sQueryHistoryResource = await getBackendSrv().put(`${this.queryHistoriesUrl}/${id}`, current);
    return this.fromK8sResource(result);
  }

  async updateStarred(id: string, starred: boolean): Promise<RichHistoryQuery> {
    // TODO: Integrate with Collections API for star/unstar
    // For now, just return the current resource
    const result: K8sQueryHistoryResource = await getBackendSrv().get(`${this.queryHistoriesUrl}/${id}`);
    return this.fromK8sResource(result, starred);
  }

  async getSettings(): Promise<RichHistorySettings> {
    const preferences = await this.preferenceService.load();
    return {
      activeDatasourcesOnly: false,
      lastUsedDatasourceFilters: undefined,
      retentionPeriod: 14,
      starredTabAsFirstTab: preferences.queryHistory?.homeTab === 'starred',
    };
  }

  async updateSettings(settings: RichHistorySettings): Promise<void> {
    return this.preferenceService.patch({
      queryHistory: {
        homeTab: settings.starredTabAsFirstTab ? 'starred' : 'query',
      },
    });
  }

  private fromK8sResource(resource: K8sQueryHistoryResource, starred?: boolean): RichHistoryQuery {
    const datasource = getDataSourceSrv().getInstanceSettings({
      uid: resource.spec?.datasourceUid,
    });

    return {
      id: resource.metadata?.name,
      createdAt: new Date(resource.metadata?.creationTimestamp).getTime(),
      datasourceName: datasource?.name || '',
      datasourceUid: resource.spec?.datasourceUid || '',
      starred: starred ?? false,
      comment: resource.spec?.comment || '',
      queries: resource.spec?.queries || [],
    };
  }

  private buildSearchParams(filters: RichHistorySearchBackendFilters): string {
    const params = new URLSearchParams();

    for (const dsName of filters.datasourceFilters) {
      const ds = getDataSourceSrv().getInstanceSettings(dsName);
      if (ds) {
        params.append('datasourceUid', ds.uid);
      }
    }

    if (filters.search) {
      params.set('query', filters.search);
    }

    if (filters.sortOrder) {
      params.set('sort', filters.sortOrder === SortOrder.Ascending ? 'time-asc' : 'time-desc');
    }

    if (!filters.starred) {
      if (filters.from) {
        params.set('from', String(filters.from));
      }
      if (filters.to) {
        params.set('to', String(filters.to));
      }
    }

    params.set('limit', '100');

    if (filters.page) {
      params.set('page', String(filters.page));
    }

    if (filters.starred) {
      params.set('onlyStarred', 'true');
    }

    return params.toString();
  }
}
