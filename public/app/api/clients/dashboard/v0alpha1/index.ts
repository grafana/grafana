import {
  type SearchDashboardsAndFoldersApiArg,
  type SearchDashboardsAndFoldersApiResponse,
  generatedAPI,
} from '@grafana/api-clients/rtkq/dashboard/v0alpha1';

export type SearchFolderChildrenPageArg = {
  folder: string;
  limit: number;
  offset: number;
  permission?: SearchDashboardsAndFoldersApiArg['permission'];
  /** List every folder and mark whether the user can create dashboards in each one */
  markReadOnly?: boolean;
};

export const dashboardAPIv0alpha1 = generatedAPI.enhanceEndpoints({}).injectEndpoints({
  endpoints: (build) => ({
    // The search API can page with `offset`, but the generated client doesn't expose that parameter yet
    searchFolderChildrenPage: build.query<SearchDashboardsAndFoldersApiResponse, SearchFolderChildrenPageArg>({
      query: ({ folder, limit, offset, permission, markReadOnly }) => ({
        url: '/search',
        params: {
          type: 'folder',
          folder,
          sort: 'title',
          limit,
          offset,
          permission: markReadOnly ? undefined : permission,
          include: markReadOnly ? 'canCreate' : undefined,
        },
      }),
    }),
  }),
});

export const { useSearchDashboardsAndFoldersQuery, useLazySearchDashboardsAndFoldersQuery } = dashboardAPIv0alpha1;
