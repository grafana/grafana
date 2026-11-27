import {
  generatedAPI,
  type SearchDashboardsAndFoldersApiArg,
  type SearchDashboardsAndFoldersApiResponse,
} from '@grafana/api-clients/rtkq/dashboard/v0alpha1';

// TODO: Remove once the generated client has the search `include` param
export const dashboardAPIv0alpha1 = generatedAPI.enhanceEndpoints({}).injectEndpoints({
  overrideExisting: true,
  endpoints: (build) => ({
    searchDashboardsAndFolders: build.query<
      SearchDashboardsAndFoldersApiResponse,
      SearchDashboardsAndFoldersApiArg & { include?: 'pathToCreatable' }
    >({
      query: (queryArg) => ({ url: '/search', params: queryArg }),
      providesTags: ['Search'],
    }),
  }),
});

export const { useSearchDashboardsAndFoldersQuery, useLazySearchDashboardsAndFoldersQuery } = dashboardAPIv0alpha1;
