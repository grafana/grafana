import { isEmpty } from 'lodash';

import { DataFrame, DataFrameView, getDisplayProcessor, SelectableValue, toDataFrame } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getBackendSrv } from '@grafana/runtime';
import { getAPIBaseURL } from 'app/api/utils';
import { TermCount } from 'app/core/components/TagFilter/TagFilter';
import kbn from 'app/core/utils/kbn';

import { deletedDashboardsCache } from './deletedDashboardsCache';
import {
  DashboardQueryResult,
  GrafanaSearcher,
  LocationInfo,
  QueryResponse,
  SearchQuery,
  SearchResultMeta,
} from './types';
import { replaceCurrentFolderQuery, filterSearchResults } from './utils';

// The backend returns an empty frame with a special name to indicate that the indexing engine is being rebuilt,
// and that it can not serve any search requests. We are temporarily using the old SQL Search API as a fallback when that happens.
const loadingFrameName = 'Loading';

const baseURL = getAPIBaseURL('dashboard.grafana.app', 'v0alpha1');
const searchURI = `${baseURL}/search`;

export type SearchHit = {
  resource: string; // dashboards | folders
  name: string;
  title: string;
  location: string;
  folder: string;
  tags: string[];

  field: Record<string, string | number>; // extra fields from the backend - sort fields included here as well

  // calculated in the frontend
  url: string;
};

export type SearchAPIResponse = {
  totalHits: number;
  hits: SearchHit[];
  facets?: {
    tags?: {
      terms?: Array<{
        term: string;
        count: number;
      }>;
    };
  };
};

const folderViewSort = 'name_sort';

export class UnifiedSearcher implements GrafanaSearcher {
  locationInfo: Promise<Record<string, LocationInfo>>;

  constructor(private fallbackSearcher: GrafanaSearcher) {
    this.locationInfo = loadLocationInfo();
  }

  async search(query: SearchQuery): Promise<QueryResponse> {
    if (query.facet?.length) {
      throw new Error('facets not supported!');
    }
    return this.doSearchQuery(query);
  }

  async starred(query: SearchQuery): Promise<QueryResponse> {
    if (query.facet?.length) {
      throw new Error('facets not supported!');
    }
    // get the starred dashboards
    const starsIds = await getBackendSrv().get('api/user/stars');
    if (starsIds?.length) {
      return this.doSearchQuery({
        ...query,
        name: starsIds,
        query: query.query ?? '*',
      });
    }
    // Nothing is starred
    return noDataResponse();
  }

  async tags(query: SearchQuery): Promise<TermCount[]> {
    const qry = query.query ?? '*';
    let uri = `${searchURI}?facet=tags&query=${qry}&limit=1`;
    const resp = await getBackendSrv().get<SearchAPIResponse>(uri);
    return resp.facets?.tags?.terms || [];
  }

  // TODO: Implement this correctly
  getSortOptions(): Promise<SelectableValue[]> {
    const opts: SelectableValue[] = [
      {
        value: folderViewSort,
        label: t('search.unified-searcher.opts.label.alphabetically-az', 'Alphabetically (A-Z)'),
      },
      { value: '-name_sort', label: t('search.unified-searcher.opts.label.alphabetically-za', 'Alphabetically (Z-A)') },
    ];

    if (config.licenseInfo.enabledFeatures.analytics) {
      for (const sf of sortFields) {
        opts.push({ value: `-${sf.name}`, label: `${sf.display} (most)` });
        opts.push({ value: `${sf.name}`, label: `${sf.display} (least)` });
      }
    }

    return Promise.resolve(opts);
  }

  async doSearchQuery(query: SearchQuery): Promise<QueryResponse> {
    const uri = await this.newRequest(query);

    let rsp: SearchAPIResponse;

    if (query.deleted) {
      const data = await deletedDashboardsCache.get();
      const results = filterSearchResults(data, query);
      rsp = { hits: results, totalHits: results.length };
    } else {
      rsp = await this.fetchResponse(uri);
    }
    const first = toDashboardResults(rsp, query.sort ?? '');
    if (first.name === loadingFrameName) {
      return this.fallbackSearcher.search(query);
    }

    const customMeta = first.meta?.custom;
    const meta: SearchResultMeta = {
      count: customMeta?.count ?? first.length,
      max_score: customMeta?.max_score ?? 1,
      locationInfo: customMeta?.locationInfo ?? {},
      sortBy: customMeta?.sortBy,
    };
    meta.locationInfo = await this.locationInfo;

    // Update the DataFrame meta to point to the typed meta object
    if (first.meta) {
      first.meta.custom = meta;
    }

    // Set the field name to a better display name
    if (meta.sortBy?.length) {
      const field = first.fields.find((f) => f.name === meta.sortBy);
      if (field) {
        const name = getSortFieldDisplayName(field.name);
        meta.sortBy = name;
        field.name = name; // make it look nicer
      }
    }

    let loadMax = 0;
    let pending: Promise<void> | undefined = undefined;
    const getNextPage = async () => {
      while (loadMax > view.dataFrame.length) {
        const offset = view.dataFrame.length;
        if (offset >= meta.count) {
          return;
        }
        const nextPageUrl = `${uri}&offset=${offset}`;
        const resp = await this.fetchResponse(nextPageUrl);
        const frame = toDashboardResults(resp, query.sort ?? '');
        if (!frame) {
          console.log('no results', frame);
          return;
        }
        if (frame.fields.length !== view.dataFrame.fields.length) {
          console.log('invalid shape', frame, view.dataFrame);
          return;
        }

        // Append the raw values to the same array buffer
        const length = frame.length + view.dataFrame.length;
        frame.fields.forEach((f) => {
          const field = view.dataFrame.fields.find((vf) => vf.name === f.name);
          if (field) {
            field.values.push(...f.values);
          }
        });

        view.dataFrame.length = length;

        // Add all the location lookup info
        const submeta = frame.meta?.custom;
        if (submeta?.locationInfo && meta) {
          // Merge locationInfo from submeta into meta
          const subLocationInfo = submeta.locationInfo;
          if (subLocationInfo && typeof subLocationInfo === 'object') {
            Object.assign(meta.locationInfo, subLocationInfo);
          }
        }
      }
      pending = undefined;
    };

    const view = new DataFrameView<DashboardQueryResult>(first);
    return {
      totalRows: meta.count ?? first.length,
      view,
      loadMoreItems: async (startIndex: number, stopIndex: number): Promise<void> => {
        loadMax = Math.max(loadMax, stopIndex);
        if (!pending) {
          pending = getNextPage();
        }
        return pending;
      },
      isItemLoaded: (index: number): boolean => {
        return index < view.dataFrame.length;
      },
    };
  }

  async fetchResponse(uri: string) {
    const rsp = await getBackendSrv().get<SearchAPIResponse>(uri);
    const isFolderCacheStale = await this.isFolderCacheStale(rsp.hits);
    if (!isFolderCacheStale) {
      return rsp;
    }
    // sync the location info (folders)
    this.locationInfo = loadLocationInfo();
    // recheck for missing folders
    const hasMissing = await this.isFolderCacheStale(rsp.hits);
    if (!hasMissing) {
      return rsp;
    }

    const locationInfo = await this.locationInfo;
    const hits = rsp.hits.map((hit) => {
      if (hit.folder === undefined) {
        return { ...hit, location: 'general', folder: 'general' };
      }

      // this means a user has permission to see this dashboard, but not the folder contents
      if (locationInfo[hit.folder] === undefined) {
        return { ...hit, location: 'sharedwithme', folder: 'sharedwithme' };
      }

      return hit;
    });

    const totalHits = rsp.totalHits - (rsp.hits.length - hits.length);
    return { ...rsp, hits, totalHits };
  }

  async isFolderCacheStale(hits: SearchHit[]): Promise<boolean> {
    const locationInfo = await this.locationInfo;
    return hits.some((hit) => {
      return hit.folder !== undefined && locationInfo[hit.folder] === undefined;
    });
  }

  private async newRequest(query: SearchQuery): Promise<string> {
    query = await replaceCurrentFolderQuery(query);

    let uri = searchURI;
    uri += `?query=${encodeURIComponent(query.query ?? '*')}`;
    uri += `&limit=${query.limit ?? pageSize}`;

    if (query.offset) {
      uri += `&offset=${query.offset}`;
    }

    if (!isEmpty(query.location)) {
      uri += `&folder=${query.location}`;
    }

    if (query.kind) {
      // filter resource types
      uri += '&' + query.kind.map((kind) => `type=${kind}`).join('&');
    }

    if (query.tags?.length) {
      uri += '&' + query.tags.map((tag) => `tag=${encodeURIComponent(tag)}`).join('&');
    }

    if (query.sort) {
      const sort = query.sort.replace('_sort', '').replace('name', 'title');
      uri += `&sort=${sort}`;
      const sortField = sort.startsWith('-') ? sort.substring(1) : sort;

      uri += `&field=${sortField}`; // we want to the sort field to be included in the response
    }

    if (query.name?.length) {
      uri += '&' + query.name.map((name) => `name=${encodeURIComponent(name)}`).join('&');
    }

    if (query.uid?.length) {
      // legacy support for filtering by dashboard uid
      uri += '&' + query.uid.map((name) => `name=${encodeURIComponent(name)}`).join('&');
    }

    if (query.deleted) {
      uri = `${getAPIBaseURL('dashboard.grafana.app', 'v1beta1')}/dashboards/?labelSelector=grafana.app/get-trash=true`;
    }
    return uri;
  }

  getFolderViewSort(): string {
    return 'name_sort';
  }
}

const pageSize = 50;

// Enterprise only sort field values for dashboards
const sortFields = [
  { name: 'views_total', display: 'Views total' },
  { name: 'views_last_30_days', display: 'Views 30 days' },
  { name: 'errors_total', display: 'Errors total' },
  { name: 'errors_last_30_days', display: 'Errors 30 days' },
];

function noDataResponse(): QueryResponse | PromiseLike<QueryResponse> {
  return {
    view: new DataFrameView({ length: 0, fields: [] }),
    totalRows: 0,
    loadMoreItems: async (startIndex: number, stopIndex: number): Promise<void> => {
      return;
    },
    isItemLoaded: (index: number): boolean => {
      return true;
    },
  };
}

/** Given the internal field name, this gives a reasonable display name for the table colum header */
function getSortFieldDisplayName(name: string) {
  for (const sf of sortFields) {
    if (sf.name === name) {
      return sf.display;
    }
  }
  return name;
}

export function toDashboardResults(rsp: SearchAPIResponse, sort: string): DataFrame {
  const hits = rsp.hits;
  if (hits.length < 1) {
    return { fields: [], length: 0 };
  }
  const dashboardHits = hits.map((hit) => {
    let location = hit.folder;
    if (hit.resource === 'dashboards' && isEmpty(location)) {
      location = 'general';
    }

    // display null field values as "-"
    const field = Object.fromEntries(
      Object.entries(hit.field ?? {}).map(([key, value]) => [key, value == null ? '-' : value])
    );

    return {
      ...hit,
      uid: hit.name,
      url: toURL(hit.resource, hit.name, hit.title),
      tags: hit.tags || [],
      folder: hit.folder || 'general',
      location,
      name: hit.title, // 🤯 FIXME hit.name is k8s name, eg grafana dashboards UID
      kind: hit.resource.substring(0, hit.resource.length - 1), // dashboard "kind" is not plural
      ...field,
    };
  });
  const frame = toDataFrame(dashboardHits);
  frame.meta = {
    custom: {
      count: rsp.totalHits,
      max_score: 1,
    },
  };
  if (sort && frame.meta.custom) {
    // trim the "-" from sort if it exists
    frame.meta.custom.sortBy = sort.startsWith('-') ? sort.substring(1) : sort;
  }

  for (const field of frame.fields) {
    field.display = getDisplayProcessor({ field, theme: config.theme2 });
  }
  return frame;
}

async function loadLocationInfo(): Promise<Record<string, LocationInfo>> {
  const uri = `${searchURI}?type=folders`;
  const rsp = getBackendSrv()
    .get<SearchAPIResponse>(uri)
    .then((rsp) => {
      const locationInfo: Record<string, LocationInfo> = {
        general: {
          kind: 'folder',
          name: 'Dashboards',
          url: '/dashboards',
        }, // share location info with everyone
        sharedwithme: {
          kind: 'sharedwithme',
          name: 'Shared with me',
          url: '',
        },
      };
      for (const hit of rsp.hits) {
        locationInfo[hit.name] = {
          name: hit.title,
          kind: 'folder',
          url: toURL('folders', hit.name, hit.title),
        };
      }
      return locationInfo;
    });
  return rsp;
}

function toURL(resource: string, name: string, title: string): string {
  if (resource === 'folders') {
    return `/dashboards/f/${name}`;
  }
  const slug = kbn.slugifyForUrl(title);
  return `/d/${name}/${slug}`;
}
