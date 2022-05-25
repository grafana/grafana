import { ArrayVector, DataFrame, DataFrameView, FieldType, getDisplayProcessor, SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { TermCount } from 'app/core/components/TagFilter/TagFilter';
import { backendSrv } from 'app/core/services/backend_srv';

import { DashboardSearchHit } from '../types';

import { LocationInfo } from './types';

import { DashboardQueryResult, GrafanaSearcher, QueryResponse, SearchQuery, SearchResultMeta } from '.';

interface APIQuery {
  title?: string;
  tag?: string[];
  limit?: number;
  page?: number;
  type?: string;
  // DashboardIds []int64
  // FolderIds    []int64
  sort?: string;

  // NEW!!!! TODO TODO: needs backend support?
  dashboardUIDs?: string[];
  folderUIDs?: string[];
}

export class SQLSearcher implements GrafanaSearcher {
  locationInfo: Record<string, LocationInfo> = {}; // share location info with everyone

  async search(query: SearchQuery): Promise<QueryResponse> {
    if (query.facet?.length) {
      throw 'facets not supported!';
    }
    const q: APIQuery = {
      limit: 1000, // 1k max values
      tag: query.tags,
      sort: query.sort,
    };

    if (query.query === '*') {
      if (query.kind?.length === 1 && query.kind[0] === 'folder') {
        q.type = 'dash-folder';
      }
    } else if (query.query?.length) {
      q.title = query.query;
    }

    if (query.uid) {
      q.dashboardUIDs = query.uid;
    } else if (query.location?.length) {
      q.folderUIDs = [query.location];
    }
    return this.doAPIQuery(q);
  }

  // returns the appropriate sorting options
  async getSortOptions(): Promise<SelectableValue[]> {
    // {
    //   "sortOptions": [
    //     {
    //       "description": "Sort results in an alphabetically ascending order",
    //       "displayName": "Alphabetically (A–Z)",
    //       "meta": "",
    //       "name": "alpha-asc"
    //     },
    //     {
    //       "description": "Sort results in an alphabetically descending order",
    //       "displayName": "Alphabetically (Z–A)",
    //       "meta": "",
    //       "name": "alpha-desc"
    //     }
    //   ]
    // }
    const opts = await backendSrv.get('/api/search/sorting');
    return opts.sortOptions.map((v: any) => ({
      value: v.name,
      label: v.displayName,
    }));
  }

  // NOTE: the bluge query will find tags within the current results, the SQL based one does not
  async tags(query: SearchQuery): Promise<TermCount[]> {
    const terms = (await backendSrv.get('/api/dashboards/tags')) as TermCount[];
    return terms.sort((a, b) => b.count - a.count);
  }

  async doAPIQuery(query: APIQuery): Promise<QueryResponse> {
    const rsp = (await backendSrv.get('/api/search', query)) as DashboardSearchHit[];

    // Field values (columnar)
    const kind: string[] = [];
    const name: string[] = [];
    const uid: string[] = [];
    const url: string[] = [];
    const tags: string[][] = [];
    const location: string[] = [];
    const sortBy: number[] = [];
    let sortMetaName: string | undefined;

    for (let hit of rsp) {
      const k = hit.type === 'dash-folder' ? 'folder' : 'dashboard';
      kind.push(k);
      name.push(hit.title);
      uid.push(hit.uid!);
      url.push(hit.url);
      tags.push(hit.tags);
      location.push(hit.folderUid!);
      sortBy.push(hit.sortMeta!);

      if (hit.sortMetaName?.length) {
        sortMetaName = hit.sortMetaName;
      }

      if (hit.folderUid && hit.folderTitle) {
        this.locationInfo[hit.folderUid] = {
          kind: 'folder',
          name: hit.folderTitle,
          url: hit.folderUrl!,
        };
      }
    }

    const data: DataFrame = {
      fields: [
        { name: 'kind', type: FieldType.string, config: {}, values: new ArrayVector(kind) },
        { name: 'name', type: FieldType.string, config: {}, values: new ArrayVector(name) },
        { name: 'uid', type: FieldType.string, config: {}, values: new ArrayVector(uid) },
        { name: 'url', type: FieldType.string, config: {}, values: new ArrayVector(url) },
        { name: 'tags', type: FieldType.other, config: {}, values: new ArrayVector(tags) },
        { name: 'location', type: FieldType.string, config: {}, values: new ArrayVector(location) },
      ],
      length: name.length,
    };

    // Add enterprise sort fields as a field in the frame
    if (sortMetaName?.length) {
      data.meta!.custom!.sortBy = sortMetaName;
      data.fields.push({
        name: sortMetaName, // Used in display
        type: FieldType.number,
        config: {},
        values: new ArrayVector(sortBy),
      });
    }

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
