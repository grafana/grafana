import { isEmpty } from 'lodash';

import { DataFrame, DataFrameView, getDisplayProcessor, SelectableValue, toDataFrame } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { TermCount } from 'app/core/components/TagFilter/TagFilter';

import {
  DashboardQueryResult,
  GrafanaSearcher,
  LocationInfo,
  QueryResponse,
  SearchQuery,
  SearchResultMeta,
} from './types';
import { replaceCurrentFolderQuery } from './utils';

// The backend returns an empty frame with a special name to indicate that the indexing engine is being rebuilt,
// and that it can not serve any search requests. We are temporarily using the old SQL Search API as a fallback when that happens.
const loadingFrameName = 'Loading';

const searchURI = `apis/dashboard.grafana.app/v0alpha1/namespaces/${config.namespace}/search`;

type SearchHit = {
  resource: string; // dashboards | folders
  name: string;
  title: string;
  location: string;
  folder: string;
  tags: string[];

  // calculated in the frontend
  url: string;
};

type SearchAPIResponse = {
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

    if (query.kind?.length === 1 && query.kind[0] === 'dashboard') {
      // TODO: this is browse mode, so skip the search
      return noDataResponse();
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
      { value: folderViewSort, label: 'Alphabetically (A-Z)' },
      { value: '-name_sort', label: 'Alphabetically (Z-A)' },
    ];

    if (config.licenseInfo.enabledFeatures.analytics) {
      for (const sf of sortFields) {
        opts.push({ value: `-${sf.name}`, label: `${sf.display} (most)` });
        opts.push({ value: `${sf.name}`, label: `${sf.display} (least)` });
      }
      for (const sf of sortTimeFields) {
        opts.push({ value: `-${sf.name}`, label: `${sf.display} (recent)` });
        opts.push({ value: `${sf.name}`, label: `${sf.display} (oldest)` });
      }
    }

    return Promise.resolve(opts);
  }

  async doSearchQuery(query: SearchQuery): Promise<QueryResponse> {
    const uri = await this.newRequest(query);
    const rsp = await getBackendSrv().get<SearchAPIResponse>(uri);

    const first = toDashboardResults(rsp);
    if (first.name === loadingFrameName) {
      return this.fallbackSearcher.search(query);
    }

    const meta = first.meta?.custom || ({} as SearchResultMeta);
    const locationInfo = await this.locationInfo;
    const hasMissing = rsp.hits.some((hit) => !locationInfo[hit.folder]);
    if (hasMissing) {
      // sync the location info ( folders )
      this.locationInfo = loadLocationInfo();
    }
    meta.locationInfo = await this.locationInfo;

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
      // TODO: implement this correctly
      while (loadMax > view.dataFrame.length) {
        const offset = view.dataFrame.length;
        if (offset >= meta.count) {
          return;
        }
        const nextPageUrl = `${uri}&offset=${offset}`;
        const resp = await getBackendSrv().get<SearchAPIResponse>(nextPageUrl);
        const frame = toDashboardResults(resp);
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
        const submeta = frame.meta?.custom as SearchResultMeta;
        if (submeta?.locationInfo && meta) {
          for (const [key, value] of Object.entries(submeta.locationInfo)) {
            meta.locationInfo[key] = value;
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

  private async newRequest(query: SearchQuery): Promise<string> {
    query = await replaceCurrentFolderQuery(query);

    let uri = searchURI;
    uri += `?query=${encodeURIComponent(query.query ?? '*')}`;
    uri += `&limit=${query.limit ?? pageSize}`;

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
    }

    if (query.name?.length) {
      uri += '&' + query.name.map((name) => `name=${encodeURIComponent(name)}`).join('&');
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

// Enterprise only time sort field values for dashboards
const sortTimeFields = [
  { name: 'created_at', display: 'Created time' },
  { name: 'updated_at', display: 'Updated time' },
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
  for (const sf of sortTimeFields) {
    if (sf.name === name) {
      return sf.display;
    }
  }
  return name;
}

function toDashboardResults(rsp: SearchAPIResponse): DataFrame {
  const hits = rsp.hits;
  if (hits.length < 1) {
    return { fields: [], length: 0 };
  }
  const dashboardHits = hits.map((hit) => {
    let location = hit.folder;
    if (hit.resource === 'dashboards' && isEmpty(location)) {
      location = 'general';
    }

    return {
      ...hit,
      uid: hit.name,
      url: toURL(hit.resource, hit.name),
      tags: hit.tags || [],
      folder: hit.folder || 'general',
      location,
      name: hit.title, // 🤯 FIXME hit.name is k8s name, eg grafana dashboards UID
      kind: hit.resource.substring(0, hit.resource.length - 1), // dashboard "kind" is not plural
    };
  });
  const frame = toDataFrame(dashboardHits);
  frame.meta = {
    custom: {
      count: rsp.totalHits,
      max_score: 1,
    },
  };
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
      };
      for (const hit of rsp.hits) {
        locationInfo[hit.name] = {
          name: hit.title,
          kind: 'folder',
          url: toURL('folders', hit.name),
        };
      }
      return locationInfo;
    });
  return rsp;
}

function toURL(resource: string, name: string): string {
  if (resource === 'folders') {
    return `/dashboards/f/${name}`;
  }
  return `/d/${name}`;
}
