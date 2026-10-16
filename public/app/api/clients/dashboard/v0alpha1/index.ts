import { type SearchDashboardsAndFoldersApiResponse, generatedAPI } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';

export type SearchFolderChildrenPageArg = {
  folder: string;
  limit: number;
  offset: number;
};

export const dashboardAPIv0alpha1 = generatedAPI.enhanceEndpoints({}).injectEndpoints({
  endpoints: (build) => ({
    // The search API can page with `offset`, but the generated client doesn't expose that parameter yet
    searchFolderChildrenPage: build.query<SearchDashboardsAndFoldersApiResponse, SearchFolderChildrenPageArg>({
      query: ({ folder, limit, offset }) => ({
        url: '/search',
        params: { type: 'folder', folder, sort: 'title', limit, offset },
      }),
    }),
  }),
});

export const { useSearchDashboardsAndFoldersQuery, useLazySearchDashboardsAndFoldersQuery } = dashboardAPIv0alpha1;
