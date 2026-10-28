import { type BaseQueryApi } from '@reduxjs/toolkit/query';

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

export type SearchTeamFoldersArg = {
  ownerReference: string[];
  /** Only list team folders on the way to one the user can create dashboards in, and flag the ones they cannot */
  markReadOnly?: boolean;
};

export type FolderChildrenPage = {
  hits: Array<DashboardHit & { readOnly?: boolean }>;
  /** Set when the folders loaded but the check for which can be picked failed, so they are all read only */
  selectabilityError?: unknown;
};

/**
 * Search args that return which of the named folders the user can create dashboards in, and so can pick.
 */
export function getSelectableFoldersArgs(names: string[]): SearchDashboardsAndFoldersApiArg {
  return { type: 'folder', permission: 'create', name: names, limit: names.length };
}

// Lets the server drop folders that lead to nothing the user can pick, and say which can be picked
const pathToCreatable = (markReadOnly?: boolean) => (markReadOnly ? 'pathToCreatable' : undefined);

async function markReadOnlyHits(hits: DashboardHit[], dispatch: BaseQueryApi['dispatch']): Promise<FolderChildrenPage> {
  if (hits.length === 0) {
    return { hits };
  }

  // Servers that don't know `include` leave `canCreate` out, so those folders need the separate check below
  if (hits.every((hit) => typeof hit.field?.canCreate === 'boolean')) {
    return { hits: hits.map((hit) => ({ ...hit, readOnly: !hit.field.canCreate })) };
  }

  try {
    const names = hits.map((hit) => hit.name);
    const selectable = await dispatch(
      generatedAPI.endpoints.searchDashboardsAndFolders.initiate(getSelectableFoldersArgs(names), {
        subscribe: false,
      })
    ).unwrap();
    const selectableNames = new Set(selectable.hits.map((hit) => hit.name));
    return { hits: hits.map((hit) => ({ ...hit, readOnly: !selectableNames.has(hit.name) })) };
  } catch (error) {
    // Keep the folders so their children can still be reached, but don't let any be picked
    return { hits: hits.map((hit) => ({ ...hit, readOnly: true })), selectabilityError: error };
  }
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
            include: pathToCreatable(markReadOnly),
          },
        });
        if (page.error) {
          return { error: page.error };
        }
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const { hits } = page.data as SearchDashboardsAndFoldersApiResponse;

        return { data: markReadOnly ? await markReadOnlyHits(hits, dispatch) : { hits } };
      },
    }),
    searchTeamFolders: build.query<FolderChildrenPage, SearchTeamFoldersArg>({
      queryFn: async ({ ownerReference, markReadOnly }, { dispatch }, _extraOptions, baseQuery) => {
        // The generated client doesn't expose `include` yet
        const result = await baseQuery({
          url: '/search',
          params: { type: 'folder', ownerReference, include: pathToCreatable(markReadOnly) },
        });
        if (result.error) {
          return { error: result.error };
        }
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const { hits } = result.data as SearchDashboardsAndFoldersApiResponse;

        return { data: markReadOnly ? await markReadOnlyHits(hits, dispatch) : { hits } };
      },
    }),
  }),
});

export const { useSearchDashboardsAndFoldersQuery, useLazySearchDashboardsAndFoldersQuery, useSearchTeamFoldersQuery } =
  dashboardAPIv0alpha1;
