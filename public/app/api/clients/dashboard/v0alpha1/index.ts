import {
  type DashboardHit,
  type SearchDashboardsAndFoldersApiArg,
  type SearchDashboardsAndFoldersApiResponse,
  generatedAPI,
} from '@grafana/api-clients/rtkq/dashboard/v0alpha1';

export type SearchFolderChildrenPageArg = {
  folder: string;
  limit: number;
  offset: number;
  permission?: SearchDashboardsAndFoldersApiArg['permission'];
  /** List every folder and flag the ones the user cannot create dashboards in */
  markReadOnly?: boolean;
};

export type FolderChildrenPage = {
  hits: Array<DashboardHit & { readOnly?: boolean }>;
};

/**
 * Search args that return which of the named folders the user can create dashboards in, and so can pick.
 */
export function getSelectableFoldersArgs(names: string[]): SearchDashboardsAndFoldersApiArg {
  return { type: 'folder', permission: 'create', name: names, limit: names.length };
}

export const dashboardAPIv0alpha1 = generatedAPI.enhanceEndpoints({}).injectEndpoints({
  endpoints: (build) => ({
    searchFolderChildrenPage: build.query<FolderChildrenPage, SearchFolderChildrenPageArg>({
      queryFn: async ({ folder, limit, offset, permission, markReadOnly }, { dispatch }, _extraOptions, baseQuery) => {
        // The search API can page with `offset`, but the generated client doesn't expose that parameter yet
        const page = await baseQuery({
          url: '/search',
          params: {
            type: 'folder',
            folder,
            sort: 'title',
            limit,
            offset,
            permission: markReadOnly ? undefined : permission,
          },
        });
        if (page.error) {
          return { error: page.error };
        }
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const { hits } = page.data as SearchDashboardsAndFoldersApiResponse;

        if (!markReadOnly || hits.length === 0) {
          return { data: { hits } };
        }

        try {
          const names = hits.map((hit) => hit.name);
          const selectable = await dispatch(
            generatedAPI.endpoints.searchDashboardsAndFolders.initiate(getSelectableFoldersArgs(names), {
              subscribe: false,
            })
          ).unwrap();
          const selectableNames = new Set(selectable.hits.map((hit) => hit.name));
          return { data: { hits: hits.map((hit) => ({ ...hit, readOnly: !selectableNames.has(hit.name) })) } };
        } catch (error) {
          return { error };
        }
      },
    }),
  }),
});

export const { useSearchDashboardsAndFoldersQuery, useLazySearchDashboardsAndFoldersQuery } = dashboardAPIv0alpha1;
