import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';

/**
 * Client for `POST .../notebooks/search`, the per-kind search endpoint mounted by
 * pkg/services/apiserver/searchroutes.
 *
 * Hand-written rather than generated: the endpoint's schemas cannot go through
 * `yarn generate-apis` today, because the envelope's `SearchResults` collides with the
 * legacy dashboards-search schema of the same name once the spec processor strips k8s
 * name prefixes. These types therefore mirror pkg/apis/search/v0alpha1/types.go by hand
 * and have to be kept in step with it.
 *
 * Only the subset the API accepts in v1 is modelled — a top-level leaf or a single `and`
 * of leaves, with text and filter predicates. `or`/`not`/`range`/`exists` exist in the Go
 * types but are rejected with 422, so representing them here would invite writing a query
 * the server refuses.
 */

const SEARCH_API_VERSION = 'search.grafana.app/v0alpha1';
const SEARCH_QUERY_KIND = 'SearchQuery';

/** Matches free text against text-capable fields; defaults to `title` when fields is omitted. */
export interface TextPredicate {
  value: string;
  fields?: string[];
}

/** Exact / set membership against one field. */
export interface FilterPredicate {
  field: string;
  operator: 'In' | 'NotIn';
  values: string[];
}

/** Exactly one property may be set; the set one names the node's type. */
export interface WhereNode {
  and?: WhereNode[];
  text?: TextPredicate;
  filter?: FilterPredicate;
}

export interface SortField {
  field: string;
  direction?: 'asc' | 'desc';
}

/**
 * The request body, minus the envelope's apiVersion/kind — those are constant and the
 * endpoint adds them, so callers cannot get them wrong.
 *
 * The server decodes with DisallowUnknownFields, so anything not declared here is a 400.
 * Never spread UI state into this.
 */
export interface NotebookSearchQuery {
  where?: WhereNode;
  sort?: SortField[];
  fields?: string[];
  facets?: string[];
  facetLimit?: number;
  limit?: number;
  continue?: string;
}

export interface ResourceRef {
  group: string;
  resource: string;
  kind: string;
  name: string;
}

export interface ResultItem {
  resource: ResourceRef;
  /** Only present when a text predicate was evaluated. */
  score?: number;
  /** The requested fields' values. Absent fields are omitted, so read defensively. */
  fields?: Record<string, unknown>;
}

/** `eq` when totalHits is exact, `lte` when it is an upper bound. */
export type TotalHitsRelation = 'eq' | 'lte';

export interface ResultsMetadata {
  continue?: string;
  totalHits: number;
  totalHitsRelation: TotalHitsRelation;
}

export interface FacetTerm {
  value: string;
  count: number;
}

export interface SearchResults {
  metadata: ResultsMetadata;
  items: ResultItem[];
  facets?: Record<string, FacetTerm[]>;
}

const notebookListTag = { type: 'Notebook' as const, id: 'LIST' };

const notebookSearchAPI = dashboardAPIv2beta1.injectEndpoints({
  endpoints: (build) => ({
    searchNotebooks: build.query<SearchResults, NotebookSearchQuery>({
      // A POST, because the query travels as a body. It is still a read, hence a query
      // rather than a mutation.
      query: (body) => ({
        url: '/notebooks/search',
        method: 'POST',
        // The namespace-scoped base URL comes from the slice's baseQuery, so the path is
        // relative here.
        body: {
          apiVersion: SEARCH_API_VERSION,
          kind: SEARCH_QUERY_KIND,
          ...body,
        },
      }),
      // Tagged as Notebook, not Search: the generated notebook mutations invalidate
      // 'Notebook', and this is the list they have to refresh.
      providesTags: (result) =>
        result
          ? [notebookListTag, ...result.items.map((item) => ({ type: 'Notebook' as const, id: item.resource.name }))]
          : [notebookListTag],
    }),
  }),
});

export const { useSearchNotebooksQuery } = notebookSearchAPI;
