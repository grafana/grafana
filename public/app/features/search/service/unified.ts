import {
  DataFrame,
  DataFrameJSON,
  DataFrameView,
  getDisplayProcessor,
  SelectableValue,
  toDataFrame,
} from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { TermCount } from 'app/core/components/TagFilter/TagFilter';

import { replaceCurrentFolderQuery } from './utils';

import { DashboardQueryResult, GrafanaSearcher, QueryResponse, SearchQuery, SearchResultMeta } from '.';

// The backend returns an empty frame with a special name to indicate that the indexing engine is being rebuilt,
// and that it can not serve any search requests. We are temporarily using the old SQL Search API as a fallback when that happens.
const loadingFrameName = 'Loading';

const searchURI = 'api/unified-search';

type SearchAPIResponse = {
  frames: DataFrameJSON[];
};

const folderViewSort = 'name_sort';

export class UnifiedSearcher implements GrafanaSearcher {
  constructor(private fallbackSearcher: GrafanaSearcher) {}

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
    const starsUIDS = await getBackendSrv().get('api/user/stars');
    if (starsUIDS?.length) {
      return this.doSearchQuery({
        uid: starsUIDS,
        query: query.query ?? '*',
      });
    }
    // Nothing is starred
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

  async tags(query: SearchQuery): Promise<TermCount[]> {
    const req = {
      ...query,
      query: query.query ?? '*',
      sort: undefined, // no need to sort the initial query results (not used)
      facet: [{ field: 'tag' }],
      limit: 1, // 0 would be better, but is ignored by the backend
    };

    const resp = await getBackendSrv().post<SearchAPIResponse>(searchURI, req);
    const frames = resp.frames.map((f) => toDataFrame(f));

    if (frames[0]?.name === loadingFrameName) {
      return this.fallbackSearcher.tags(query);
    }

    for (const frame of frames) {
      if (frame.fields[0].name === 'tag') {
        return getTermCountsFrom(frame);
      }
    }

    return [];
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
    query = await replaceCurrentFolderQuery(query);
    const req = {
      ...query,
      query: query.query ?? '*',
      limit: query.limit ?? firstPageSize,
    };

    const rsp = await getBackendSrv().post<SearchAPIResponse>(searchURI, req);
    const frames = rsp.frames.map((f) => toDataFrame(f));

    const first = frames.length ? toDataFrame(frames[0]) : { fields: [], length: 0 };

    if (first.name === loadingFrameName) {
      return this.fallbackSearcher.search(query);
    }

    for (const field of first.fields) {
      field.display = getDisplayProcessor({ field, theme: config.theme2 });
    }

    // Make sure the object exists
    if (!first.meta?.custom) {
      first.meta = {
        ...first.meta,
        custom: {
          count: first.length,
          max_score: 1,
        },
      };
    }

    const meta = first.meta.custom as SearchResultMeta;
    if (!meta.locationInfo) {
      meta.locationInfo = {}; // always set it so we can append
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
        const from = view.dataFrame.length;
        if (from >= meta.count) {
          return;
        }
        const resp = await getBackendSrv().post<SearchAPIResponse>(searchURI, {
          ...(req ?? {}),
          from,
          limit: nextPageSizes,
        });
        const frame = toDataFrame(resp.frames[0]);

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
        for (let i = 0; i < frame.fields.length; i++) {
          const values = view.dataFrame.fields[i].values;
          values.push(...frame.fields[i].values);
        }
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

  getFolderViewSort(): string {
    return 'name_sort';
  }
}

const firstPageSize = 50;
const nextPageSizes = 100;

function getTermCountsFrom(frame: DataFrame): TermCount[] {
  const keys = frame.fields[0].values;
  const vals = frame.fields[1].values;
  const counts: TermCount[] = [];
  for (let i = 0; i < frame.length; i++) {
    counts.push({ term: keys[i], count: vals[i] });
  }
  return counts;
}

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
