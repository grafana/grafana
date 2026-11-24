export { BASE_URL, API_GROUP, API_VERSION } from './baseAPI';
import { type GlobalSearchQuery, type GlobalSearchResults, generatedAPI as rawAPI } from './endpoints.gen';

export * from './endpoints.gen';

/**
 * Global search is cursor-paginated: the cursor travels in the request body and comes back in
 * `metadata.continue`. The generated client only exposes the single-page query, so this endpoint owns
 * the cursor and hands the caller whole pages.
 */
export const generatedAPI = rawAPI.injectEndpoints({
  endpoints: (build) => ({
    searchGlobal: build.infiniteQuery<GlobalSearchResults, Omit<GlobalSearchQuery, 'continue'>, string | undefined>({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        // Runs while rendering, so a response without `metadata` ends the list instead of throwing.
        getNextPageParam: (lastPage) => lastPage.metadata?.continue || undefined,
      },
      query: ({ queryArg, pageParam }) => ({
        url: '/global/search',
        method: 'POST',
        // Always set, so a cursor in the argument never reaches the server.
        body: { ...queryArg, continue: pageParam },
      }),
      providesTags: ['Search'],
    }),
  }),
  overrideExisting: false,
});

export const { useSearchGlobalInfiniteQuery } = generatedAPI;
