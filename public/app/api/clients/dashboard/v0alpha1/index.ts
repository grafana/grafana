import {
  generatedAPI,
  type SearchDashboardsAndFoldersApiArg,
  type SearchDashboardsAndFoldersApiResponse,
} from '@grafana/api-clients/rtkq/dashboard/v0alpha1';

export const dashboardAPIv0alpha1 = generatedAPI.injectEndpoints({
  endpoints: (builder) => ({
    // The search endpoint supports offsets, but the generated client does not expose them.
    listFolderChildren: builder.query<
      SearchDashboardsAndFoldersApiResponse,
      Pick<SearchDashboardsAndFoldersApiArg, 'folder' | 'permission'> & { offset: number; limit: number }
    >({
      query: (args) => ({ url: '/search', params: { ...args, type: 'folder', sort: 'title' } }),
      providesTags: ['Search'],
    }),
  }),
});

export const { useSearchDashboardsAndFoldersQuery, useLazySearchDashboardsAndFoldersQuery } = dashboardAPIv0alpha1;
