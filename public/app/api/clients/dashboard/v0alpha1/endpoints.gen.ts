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
            folder: queryArg.folder,
            sort: queryArg.sort,
          },
        }),
        providesTags: ['Search'],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as generatedAPI };
export type GetSearchApiResponse = /** status 200 undefined */ {
  /** APIVersion defines the versioned schema of this representation of an object. Servers should convert recognized schemas to the latest internal value, and may reject unrecognized values. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#resources */
  apiVersion?: string;
  /** Facet results */
  facets?: {
    [key: string]: any;
  };
  /** The dashboard body (unstructured for now) */
  hits: any[];
  /** Kind is a string value representing the REST resource this object represents. Servers may infer this from the endpoint the client submits requests to. Cannot be updated. In CamelCase. More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds */
  kind?: string;
  /** Max score */
  maxScore?: number;
  /** Where the query started from */
  offset?: number;
  /** Cost of running the query */
  queryCost?: number;
  /** How are the results sorted */
  sortBy?: any;
  /** The number of matching results */
  totalHits: number;
};
export type GetSearchApiArg = {
  /** user query string */
  query?: string;
  /** search/list within a folder (not recursive) */
  folder?: string;
  /** sortable field */
  sort?: string;
};
