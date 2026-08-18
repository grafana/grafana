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
interface TextPredicate {
  value: string;
  fields?: string[];
}

/** Exact / set membership against one field. */
interface FilterPredicate {
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

interface SortField {
  field: string;
  direction?: 'asc' | 'desc';
}

/**
 * The request body, minus the envelope's apiVersion/kind — those are constant and the
 * endpoint adds them, so callers cannot get them wrong.
 *
 * `continue` is absent on purpose: it is the page cursor, supplied per page by the endpoint below,
 * and including it here would make every page a separate cache entry rather than one paged list.
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
}

interface ResourceRef {
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
type TotalHitsRelation = 'eq' | 'lte';

interface ResultsMetadata {
  continue?: string;
  totalHits: number;
  totalHitsRelation: TotalHitsRelation;
}

interface FacetTerm {
  value: string;
  count: number;
}

export interface SearchResults {
  metadata: ResultsMetadata;
  items: ResultItem[];
  facets?: Record<string, FacetTerm[]>;
}

const notebookListTag = { type: 'Notebook' as const, id: 'LIST' };

/**
 * Ceiling on how many notebooks one filter will accumulate. The pages are followed for the caller,
 * so without a stop a broad query would walk the whole library a page at a time.
 *
 * Counted in rows rather than pages, so it does not silently change meaning when the page size
 * does — though a smaller page size does mean more requests to reach the same ceiling.
 */
const MAX_ACCUMULATED_NOTEBOOKS = 2000;

/** The cursor for the next page: absent on the first request, opaque afterwards. */
type PageCursor = string | undefined;

const notebookSearchAPI = dashboardAPIv2beta1.injectEndpoints({
  endpoints: (build) => ({
    /**
     * One cache entry per filter, holding however many cursor pages have been taken for it. The
     * caller reads `data.pages` and asks for the next one; the endpoint decides when there is none
     * left to ask for.
     */
    searchNotebooks: build.infiniteQuery<SearchResults, NotebookSearchQuery, PageCursor>({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage, allPages) => {
          const loaded = allPages.reduce((total, page) => total + page.items.length, 0);
          if (loaded >= MAX_ACCUMULATED_NOTEBOOKS) {
            return undefined;
          }
          // An empty token means the server has nothing after this page. It also offers a token on
          // a short page when its total is inexact, so the only reliable end is the token itself.
          return lastPage.metadata.continue || undefined;
        },
        // maxPages is deliberately unset: it is a sliding window that evicts the pages already
        // taken, which is the opposite of accumulating them.
      },
      // A POST, because the query travels as a body. It is still a read, hence a query
      // rather than a mutation.
      query: ({ queryArg, pageParam }) => ({
        url: '/notebooks/search',
        method: 'POST',
        // The namespace-scoped base URL comes from the slice's baseQuery, so the path is
        // relative here.
        body: {
          apiVersion: SEARCH_API_VERSION,
          kind: SEARCH_QUERY_KIND,
          ...queryArg,
          ...(pageParam ? { continue: pageParam } : {}),
        },
      }),
      // Tagged as Notebook, not Search: the generated notebook mutations invalidate
      // 'Notebook', and this is the list they have to refresh.
      providesTags: (result) =>
        result
          ? [
              notebookListTag,
              ...result.pages.flatMap((page) =>
                page.items.map((item) => ({ type: 'Notebook' as const, id: item.resource.name }))
              ),
            ]
          : [notebookListTag],
    }),
  }),
});

export const { useSearchNotebooksInfiniteQuery } = notebookSearchAPI;
