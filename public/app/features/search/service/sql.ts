import { DataFrame, DataFrameView, FieldType, getDisplayProcessor, SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { TermCount } from 'app/core/components/TagFilter/TagFilter';
import { backendSrv } from 'app/core/services/backend_srv';
import { PermissionLevelString } from 'app/types';

import { DEFAULT_MAX_VALUES, GENERAL_FOLDER_UID, TYPE_KIND_MAP } from '../constants';
import { DashboardSearchHit, DashboardSearchItemType } from '../types';

import { DashboardQueryResult, GrafanaSearcher, LocationInfo, QueryResponse, SearchQuery } from './types';
import { replaceCurrentFolderQuery } from './utils';

interface APIQuery {
  query?: string;
  tag?: string[];
  limit?: number;
  page?: number;
  type?: DashboardSearchItemType;
  dashboardUID?: string[];
  folderUIDs?: string[];
  sort?: string;
  starred?: boolean;
  permission?: PermissionLevelString;
  deleted?: boolean;
}

// Internal object to hold folderId
interface LocationInfoEXT extends LocationInfo {
  folderUid?: string;
}

export class SQLSearcher implements GrafanaSearcher {
  locationInfo: Record<string, LocationInfoEXT> = {
    general: {
      kind: 'folder',
      name: 'Dashboards',
      url: '/dashboards',
    },
  }; // share location info with everyone

  private async composeQuery(apiQuery: APIQuery, searchOptions: SearchQuery): Promise<APIQuery> {
    const query = await replaceCurrentFolderQuery(searchOptions);

    if (query.query?.length && query.query !== '*') {
      apiQuery.query = query.query;
    }

    // search v1 supports only one kind
    if (query.kind?.length === 1 && TYPE_KIND_MAP[query.kind[0]]) {
      apiQuery.type = TYPE_KIND_MAP[query.kind[0]];
    }

    if (query.uid) {
      apiQuery.dashboardUID = query.uid;
    } else if (query.location?.length) {
      apiQuery.folderUIDs = [query.location];
    }

    return apiQuery;
  }

  async search(query: SearchQuery): Promise<QueryResponse> {
    if (query.facet?.length) {
      throw new Error('facets not supported!');
    }

    if (query.from !== undefined) {
      if (!query.limit) {
        throw new Error('Must specify non-zero limit parameter when using from');
      }

      if ((query.from / query.limit) % 1 !== 0) {
        throw new Error('From parameter must be a multiple of limit');
      }
    }

    const limit = query.limit ?? (query.from !== undefined ? 1 : DEFAULT_MAX_VALUES);
    const page =
      query.from !== undefined
        ? // prettier-ignore
          (query.from / limit) + 1 // pages are 1-indexed, so need to +1 to get there
        : undefined;

    const q = await this.composeQuery(
      {
        limit: limit,
        tag: query.tags,
        sort: query.sort,
        permission: query.permission,
        page,
        deleted: query.deleted,
      },
      query
    );

    return this.doAPIQuery(q);
  }

  async starred(query: SearchQuery): Promise<QueryResponse> {
    if (query.facet?.length) {
      throw new Error('facets not supported!');
    }

    const q = await this.composeQuery(
      {
        limit: query.limit ?? DEFAULT_MAX_VALUES, // default 1k max values
        tag: query.tags,
        sort: query.sort,
        starred: query.starred,
      },
      query
    );

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
    const terms = await backendSrv.get<TermCount[]>('/api/dashboards/tags');
    return terms.sort((a, b) => b.count - a.count);
  }

  async doAPIQuery(query: APIQuery): Promise<QueryResponse> {
    const rsp = await backendSrv.get<DashboardSearchHit[]>('/api/search', query);

    // Field values (columnar)
    const kind: string[] = [];
    const name: string[] = [];
    const uid: string[] = [];
    const url: string[] = [];
    const tags: string[][] = [];
    const location: string[] = [];
    const sortBy: number[] = [];
    const isDeleted: boolean[] = [];
    const permanentlyDeleteDate: Array<Date | undefined> = [];
    let sortMetaName: string | undefined;

    for (let hit of rsp) {
      const k = hit.type === 'dash-folder' ? 'folder' : 'dashboard';
      kind.push(k);
      name.push(hit.title);
      uid.push(hit.uid);
      url.push(hit.url);
      tags.push(hit.tags);
      sortBy.push(hit.sortMeta!);
      isDeleted.push(hit.isDeleted ?? false);
      permanentlyDeleteDate.push(hit.permanentlyDeleteDate ? new Date(hit.permanentlyDeleteDate) : undefined);

      let v = hit.folderUid;
      if (!v && k === 'dashboard') {
        v = GENERAL_FOLDER_UID;
      }
      location.push(v!);

      if (hit.sortMetaName?.length) {
        sortMetaName = hit.sortMetaName;
      }

      if (hit.folderUid && hit.folderTitle) {
        this.locationInfo[hit.folderUid] = {
          kind: 'folder',
          name: hit.folderTitle,
          url: hit.folderUrl!,
          folderUid: hit.folderUid,
        };
      } else if (k === 'folder') {
        this.locationInfo[hit.uid] = {
          kind: k,
          name: hit.title!,
          url: hit.url,
          folderUid: hit.folderUid,
        };
      }
    }

    const data: DataFrame = {
      fields: [
        { name: 'kind', type: FieldType.string, config: {}, values: kind },
        { name: 'name', type: FieldType.string, config: {}, values: name },
        { name: 'uid', type: FieldType.string, config: {}, values: uid },
        { name: 'url', type: FieldType.string, config: {}, values: url },
        { name: 'tags', type: FieldType.other, config: {}, values: tags },
        { name: 'location', type: FieldType.string, config: {}, values: location },
        { name: 'isDeleted', type: FieldType.boolean, config: {}, values: isDeleted },
        { name: 'permanentlyDeleteDate', type: FieldType.time, config: {}, values: permanentlyDeleteDate },
      ],
      length: name.length,
      meta: {
        custom: {
          count: name.length,
          max_score: 1,
          locationInfo: this.locationInfo,
        },
      },
    };

    // Add enterprise sort fields as a field in the frame
    if (sortMetaName?.length && sortBy.length) {
      data.meta!.custom!.sortBy = sortMetaName;
      data.fields.push({
        name: sortMetaName, // Used in display
        type: FieldType.number,
        config: {},
        values: sortBy,
      });
    }

    for (const field of data.fields) {
      field.display = getDisplayProcessor({ field, theme: config.theme2 });
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

  getFolderViewSort = () => {
    // sorts alphabetically in memory after retrieving the folders from the database
    return '';
  };
}
