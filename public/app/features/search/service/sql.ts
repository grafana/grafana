import { DataFrameView, getDisplayProcessor, MutableDataFrame } from '@grafana/data';
import { config } from '@grafana/runtime';
import { TermCount } from 'app/core/components/TagFilter/TagFilter';
import { backendSrv } from 'app/core/services/backend_srv';

import { DashboardSearchHit } from '../types';

import { LocationInfo } from './types';

import { DashboardQueryResult, GrafanaSearcher, QueryResponse, SearchQuery, SearchResultMeta } from '.';

interface APIQuery {
  title?: string;
  tags?: string;
  Limit?: number;
  page?: number;
  isStarred?: boolean;
  type?: string;
  // DashboardIds []int64
  // FolderIds    []int64
  sort?: string;
}

export class SQLSearcher implements GrafanaSearcher {
  locationInfo: Record<string, LocationInfo> = {}; // share location info with everyone

  async search(query: SearchQuery): Promise<QueryResponse> {
    if (query.facet?.length) {
      throw 'facets not supported!';
    }
    const q: APIQuery = {};
    if (query.tags) {
      q.tags = query.tags.join(',');
    }
    return this.doAPIQuery(q);
  }

  // location is the folderUID
  async list(location: string): Promise<QueryResponse> {
    console.log('LIST', location);

    return this.doAPIQuery({});
  }

  async tags(query: SearchQuery): Promise<TermCount[]> {
    return backendSrv.get('/api/dashboards/tags');
  }

  async doAPIQuery(query: APIQuery): Promise<QueryResponse> {
    const rsp = (await backendSrv.get('/api/search', query)) as DashboardSearchHit[];

    console.log('GOT', rsp);

    const data = new MutableDataFrame();

    for (const field of data.fields) {
      field.display = getDisplayProcessor({ field, theme: config.theme2 });
    }

    // Make sure the object exists
    if (!data.meta?.custom) {
      data.meta = {
        ...data.meta,
        custom: {
          count: data.length,
          max_score: 1,
        },
      };
    }

    const meta = data.meta.custom as SearchResultMeta;
    if (!meta.locationInfo) {
      meta.locationInfo = this.locationInfo;
    }
    const view = new DataFrameView<DashboardQueryResult>(data);
    return {
      totalRows: data.length,
      view,

      // Paging not supported with this version
      loadMoreItems: async (startIndex: number, stopIndex: number): Promise<void> => {},
      isItemLoaded: (index: number): boolean => true,
    };
  }
}
