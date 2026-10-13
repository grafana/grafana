import { type SearchDashboardsAndFoldersApiResponse, generatedAPI } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';

export const dashboardAPIv0alpha1 = generatedAPI.enhanceEndpoints({}).injectEndpoints({
  endpoints: (build) => ({
    // The search API can filter by `name`, but the generated client doesn't expose that parameter yet
    getEditableFolderNames: build.query<string[], { names: string[] }>({
      query: ({ names }) => ({
        url: '/search',
        params: { type: 'folder', permission: 'edit', name: names, limit: names.length },
      }),
      transformResponse: (response: SearchDashboardsAndFoldersApiResponse) => response.hits.map((hit) => hit.name),
    }),
  }),
});

export const {
  useSearchDashboardsAndFoldersQuery,
  useLazySearchDashboardsAndFoldersQuery,
  useGetEditableFolderNamesQuery,
} = dashboardAPIv0alpha1;
