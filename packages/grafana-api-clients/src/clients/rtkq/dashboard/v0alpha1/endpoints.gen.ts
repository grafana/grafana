import { api } from './baseAPI';
export const addTagTypes = ['Search'] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getSearch: build.query<GetSearchApiResponse, GetSearchApiArg>({
        query: (queryArg) => ({
          url: `/search`,
          params: {
            query: queryArg.query,
            type: queryArg['type'],
            folder: queryArg.folder,
            facet: queryArg.facet,
            tags: queryArg.tags,
            sort: queryArg.sort,
            limit: queryArg.limit,
            explain: queryArg.explain,
          },
        }),
        providesTags: ['Search'],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as generatedAPI };
export type GetSearchApiResponse = /** status 200 undefined */ SearchResults;
export type GetSearchApiArg = {
  /** user query string */
  query?: string;
  /** search dashboards or folders.  When empty, this will search both */
  type?: 'folder' | 'dashboard';
  /** search/list within a folder (not recursive) */
  folder?: string;
  /** count distinct terms for selected fields */
  facet?: string[];
  /** tag query filter */
  tags?: string[];
  /** sortable field */
  sort?: string;
  /** number of results to return */
  limit?: number;
  /** add debugging info that may help explain why the result matched */
  explain?: boolean;
};
export type TermFacet = {
  count?: number;
  term?: string;
};
export type FacetResult = {
  field?: string;
  /** The number of documents that do *not* have this field */
  missing?: number;
  terms?: TermFacet[];
  /** The distinct terms */
  total?: number;
};
export type ManagedBy = {
  id?: string;
  kind: string;
};
export type DashboardHit = {
  /** Dashboard description */
  description?: string;
  /** Explain the score (if possible) */
  explain?: any;
  /** Stick untyped extra fields in this object (including the sort value) */
  field?: any;
  /** The k8s name (eg, grafana UID) for the parent folder */
  folder?: string;
  managedBy?: ManagedBy;
  /** The k8s "name" (eg, grafana UID) */
  name: string;
  /** Dashboard or folder */
  resource: string;
  /** When using "real" search, this is the score */
  score?: number;
  /** Filter tags */
  tags?: string[];
  /** The display name */
  title: string;
};
export type SortBy = {
  desc?: boolean;
  field: string;
};
export type SearchResults = {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  facets?: {
    [key: string]: FacetResult;
  };
  hits: DashboardHit[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  /** Max score */
  maxScore?: number;
  /** Where the query started from */
  offset?: number;
  /** Cost of running the query */
  queryCost?: number;
  sortBy?: SortBy;
  /** The number of matching results */
  totalHits: number;
};
