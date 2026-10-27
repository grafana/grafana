import { dashboardAPIv2beta1 } from 'app/api/clients/dashboard/v2beta1';
import {
  SEARCH_API_VERSION,
  SEARCH_QUERY_KIND,
  type SearchQueryBody,
  type SearchResultItem,
  type SearchResults,
} from 'app/features/apiserver/search';
import { dispatch } from 'app/types/store';

/**
 * Client for `POST .../notebooks/search`, the per-kind search endpoint mounted by
 * pkg/services/apiserver/searchroutes. The request and result shapes are the shared
 * search.grafana.app types.
 */

export type ResultItem = SearchResultItem;

/**
 * `continue` is absent on purpose: it is the page cursor, supplied per page by the endpoint below,
 * and including it here would make every page a separate cache entry rather than one paged list.
 */
export type NotebookSearchQuery = Omit<SearchQueryBody, 'continue'>;

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

    /**
     * The distinct values of one field across every notebook the query matches, for a caller
     * populating a filter or a picker. Asks for a single row because the rows are not wanted: a facet
     * is aggregated over the match set rather than over the page returned.
     *
     * Its own endpoint rather than a flag on the search above, and deliberately tagged with nothing.
     * The search provides the `Notebook` type because it is a list that writes must refresh; the
     * generated notebook mutations invalidate that type in bulk, so sharing it would have every write
     * refetch this. A caller holding this open for the length of an editing session would then re-ask
     * on every autosave, for options it may never show. Its callers decide when to ask instead — the
     * header's tag editor once per mount, the list's tag filter each time the picker is opened —
     * which for a dropdown of suggestions is the right staleness.
     */
    notebookFieldFacet: build.query<SearchResults, { field: string; limit: number }>({
      query: ({ field, limit }) => ({
        url: '/notebooks/search',
        method: 'POST',
        body: {
          apiVersion: SEARCH_API_VERSION,
          kind: SEARCH_QUERY_KIND,
          facets: [field],
          facetLimit: limit,
          limit: 1,
        },
      }),
    }),

    /**
     * Title matches for the command palette.
     *
     * Provides the `Notebook` tag that the generated notebook mutations invalidate, so a notebook
     * deleted between two identical searches stops being offered — untagged, the cached entry would
     * answer the repeat. Sharing that tag is free here because the only caller dispatches with
     * `subscribe: false`: an invalidated entry with no subscribers is dropped rather than refetched.
     */
    searchNotebookTitles: build.query<SearchResults, { query: string; limit: number }>({
      query: ({ query, limit }) => ({
        url: '/notebooks/search',
        method: 'POST',
        body: {
          apiVersion: SEARCH_API_VERSION,
          kind: SEARCH_QUERY_KIND,
          where: { text: { value: query, fields: ['title'] } },
          fields: ['title'],
          limit,
        },
      }),
      providesTags: [notebookListTag],
    }),
  }),
});

/**
 * Imperative rather than a hook: the caller is a debounced module-level function, not a component.
 */
export async function searchNotebookTitles(query: string, limit: number): Promise<ResultItem[]> {
  const { data, error } = await dispatch(
    notebookSearchAPI.endpoints.searchNotebookTitles.initiate({ query, limit }, { subscribe: false })
  );

  if (error) {
    throw error;
  }

  // An invalidation mid-flight drops the entry, leaving neither data nor error.
  return data?.items ?? [];
}

export const { useSearchNotebooksInfiniteQuery, useLazyNotebookFieldFacetQuery } = notebookSearchAPI;
