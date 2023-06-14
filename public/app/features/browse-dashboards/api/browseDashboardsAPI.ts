import { BaseQueryFn, createApi, TagDescription } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { isTruthy } from '@grafana/data';
import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { getGrafanaSearcher } from 'app/features/search/service';
import { getFolderChildren } from 'app/features/search/service/folders';
import { NestedFolderDTO } from 'app/features/search/service/types';
import { queryResultToViewItem } from 'app/features/search/service/utils';
import { DashboardViewItem } from 'app/features/search/types';
import { DashboardDTO, DescendantCount, DescendantCountDTO, FolderDTO, SaveDashboardResponseDTO } from 'app/types';

import { findItem } from '../state/utils';
import { DashboardTreeSelection, DashboardViewItemCollection } from '../types';

export const ROOT_PAGE_SIZE = 50;
export const PAGE_SIZE = 999;

interface RequestOptions extends BackendSrvRequest {
  manageError?: (err: unknown) => { error: unknown };
  showErrorAlert?: boolean;
}

function createBackendSrvBaseQuery({ baseURL }: { baseURL: string }): BaseQueryFn<RequestOptions> {
  async function backendSrvBaseQuery(requestOptions: RequestOptions) {
    try {
      const { data: responseData, ...meta } = await lastValueFrom(
        getBackendSrv().fetch({
          ...requestOptions,
          url: baseURL + requestOptions.url,
          showErrorAlert: requestOptions.showErrorAlert,
        })
      );
      return { data: responseData, meta };
    } catch (error) {
      return requestOptions.manageError ? requestOptions.manageError(error) : { error };
    }
  }

  return backendSrvBaseQuery;
}

export const browseDashboardsAPI = createApi({
  tagTypes: ['getFolder', 'getFolderChildren'],
  reducerPath: 'browseDashboardsAPI',
  baseQuery: createBackendSrvBaseQuery({ baseURL: '/api' }),
  endpoints: (builder) => ({
    deleteFolder: builder.mutation<void, FolderDTO>({
      invalidatesTags: (_result, _error, folder) => [
        { type: 'getFolder', id: folder.uid },
        { type: 'getFolderChildren', id: folder.parentUid },
      ],
      query: ({ uid }) => ({
        url: `/folders/${uid}`,
        method: 'DELETE',
        params: {
          // TODO: Once backend returns alert rule counts, set this back to true
          // when this is merged https://github.com/grafana/grafana/pull/67259
          forceDeleteRules: false,
        },
      }),
    }),
    getFolder: builder.query<FolderDTO, string>({
      providesTags: (_result, _error, arg) => [{ type: 'getFolder', id: arg }],
      query: (folderUID) => ({ url: `/folders/${folderUID}`, params: { accesscontrol: true } }),
    }),
    moveFolder: builder.mutation<void, { folder: FolderDTO; destinationUID: string }>({
      invalidatesTags: (_result, _error, arg) => [
        { type: 'getFolder', id: arg.folder.uid },
        { type: 'getFolderChildren', id: arg.folder.parentUid },
        { type: 'getFolderChildren', id: arg.destinationUID },
      ],
      query: ({ folder, destinationUID }) => ({
        url: `/folders/${folder.uid}/move`,
        method: 'POST',
        data: { parentUID: destinationUID },
      }),
    }),
    saveFolder: builder.mutation<FolderDTO, FolderDTO>({
      invalidatesTags: (_result, _error, args) => [
        { type: 'getFolder', id: args.uid },
        { type: 'getFolderChildren', id: args.parentUid },
      ],
      query: (folder) => ({
        method: 'PUT',
        showErrorAlert: false,
        url: `/folders/${folder.uid}`,
        data: {
          title: folder.title,
          version: folder.version,
        },
      }),
    }),
    bulkDelete: builder.mutation<
      void,
      {
        selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>;
        rootItems: DashboardViewItem[] | undefined;
        childrenByParentUID: Record<string, DashboardViewItemCollection | undefined>;
      }
    >({
      invalidatesTags: (_result, _error, args) => {
        const { selectedItems, rootItems, childrenByParentUID } = args;
        const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
        const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
        const tagsToInvalidate: Array<TagDescription<'getFolder' | 'getFolderChildren'>> = [];

        for (const folderUID of selectedFolders) {
          // find the parent folder uid to invalidate the children
          const folder = findItem(rootItems ?? [], childrenByParentUID, folderUID);
          tagsToInvalidate.push({ type: 'getFolder', id: folderUID });
          tagsToInvalidate.push({ type: 'getFolderChildren', id: folder?.parentUID });
        }

        for (const dashboardUID of selectedDashboards) {
          // find the parent folder uid to invalidate the children
          const dashboard = findItem(rootItems ?? [], childrenByParentUID, dashboardUID);
          tagsToInvalidate.push({ type: 'getFolderChildren', id: dashboard?.parentUID });
        }
        return tagsToInvalidate;
      },
      queryFn: async (args, _api, _extraOptions, baseQuery) => {
        const { selectedItems } = args;
        const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
        const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
        // Delete all the folders sequentially
        // TODO error handling here
        for (const folderUID of selectedFolders) {
          await baseQuery({
            url: `/folders/${folderUID}`,
            method: 'DELETE',
            params: {
              // TODO: Once backend returns alert rule counts, set this back to true
              // when this is merged https://github.com/grafana/grafana/pull/67259
              forceDeleteRules: false,
            },
          });
        }

        // Delete all the dashboards sequentially
        // TODO error handling here
        for (const dashboardUID of selectedDashboards) {
          await baseQuery({
            url: `/dashboards/uid/${dashboardUID}`,
            method: 'DELETE',
          });
        }
        return { data: undefined };
      },
    }),
    bulkMove: builder.mutation<
      void,
      {
        selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>;
        rootItems: DashboardViewItem[] | undefined;
        childrenByParentUID: Record<string, DashboardViewItemCollection | undefined>;
        destinationUID: string;
      }
    >({
      invalidatesTags: (_result, _error, args) => {
        const { selectedItems, rootItems, childrenByParentUID } = args;
        const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
        const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
        const tagsToInvalidate: Array<TagDescription<'getFolder' | 'getFolderChildren'>> = [];

        tagsToInvalidate.push({ type: 'getFolderChildren', id: args.destinationUID });
        for (const folderUID of selectedFolders) {
          // find the parent folder uid to invalidate the children
          const folder = findItem(rootItems ?? [], childrenByParentUID, folderUID);
          tagsToInvalidate.push({ type: 'getFolder', id: folderUID });
          tagsToInvalidate.push({ type: 'getFolderChildren', id: folder?.parentUID });
        }

        for (const dashboardUID of selectedDashboards) {
          // find the parent folder uid to invalidate the children
          const dashboard = findItem(rootItems ?? [], childrenByParentUID, dashboardUID);
          tagsToInvalidate.push({ type: 'getFolderChildren', id: dashboard?.parentUID });
        }
        return tagsToInvalidate;
      },
      queryFn: async (args, _api, _extraOptions, baseQuery) => {
        const { selectedItems, destinationUID } = args;
        const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
        const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);

        // Move all the folders sequentially
        // TODO error handling here
        for (const folderUID of selectedFolders) {
          await baseQuery({
            url: `/folders/${folderUID}/move`,
            method: 'POST',
            data: { parentUID: destinationUID },
          });
        }

        // Move all the dashboards sequentially
        // TODO error handling here
        for (const dashboardUID of selectedDashboards) {
          const fullDash: DashboardDTO = await getBackendSrv().get(`/api/dashboards/uid/${dashboardUID}`);

          const options = {
            dashboard: fullDash.dashboard,
            folderUid: destinationUID,
            overwrite: false,
            message: '',
          };

          await baseQuery({
            url: `/dashboards/db`,
            method: 'POST',
            data: options,
          });
        }
        return { data: undefined };
      },
    }),
    getAffectedItems: builder.query<DescendantCount, DashboardTreeSelection>({
      queryFn: async (selectedItems) => {
        const folderUIDs = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);

        const promises = folderUIDs.map((folderUID) => {
          return getBackendSrv().get<DescendantCountDTO>(`/api/folders/${folderUID}/counts`);
        });

        const results = await Promise.all(promises);

        const totalCounts = {
          folder: Object.values(selectedItems.folder).filter(isTruthy).length,
          dashboard: Object.values(selectedItems.dashboard).filter(isTruthy).length,
          libraryPanel: 0,
          alertRule: 0,
        };

        for (const folderCounts of results) {
          totalCounts.folder += folderCounts.folder;
          totalCounts.dashboard += folderCounts.dashboard;
          totalCounts.alertRule += folderCounts.alertrule ?? 0;

          // TODO enable these once the backend correctly returns them
          // totalCounts.libraryPanel += folderCounts.libraryPanel;
        }

        return { data: totalCounts };
      },
    }),
    listFolders: builder.query<
      DashboardViewItem[],
      {
        parentUID?: string;
        parentTitle?: string;
        page?: number;
        pageSize?: number;
      }
    >({
      query: ({ parentUID, page = 1, pageSize = PAGE_SIZE }) => ({
        url: `/folders`,
        data: { parentUID, page, limit: pageSize },
      }),
      // Only have one cache entry for each parentUID
      serializeQueryArgs: ({ endpointName, queryArgs }) => {
        const { parentUID } = queryArgs;
        return `${endpointName}(${parentUID})`;
      },
      // Merge incoming data to the cache entry
      merge: (currentCache, newItems) => {
        currentCache.push(...newItems);
      },
      // Refetch when the page arg changes
      forceRefetch({ currentArg, previousArg }) {
        return (currentArg && currentArg.page) !== (previousArg && previousArg.page);
      },
      transformResponse: (response: NestedFolderDTO[], _meta, arg) => {
        const { parentUID, parentTitle } = arg;
        return response.map((folder) => ({
          kind: 'folder',
          uid: folder.uid,
          title: folder.title,
          parentUID,
          parentTitle,
          url: `/dashboards/f/${folder.uid}`,
        }));
      },
    }),
    getFolderChildren: builder.query<DashboardViewItem[], string>({
      providesTags: (_result, _error, arg) => [{ type: 'getFolderChildren', id: arg }],
      queryFn: async (folderUID) => {
        const children = await getFolderChildren(folderUID, undefined, true);
        return {
          data: children,
        };
      },
    }),
    listDashboards: builder.query<
      DashboardViewItem[],
      {
        parentUID?: string;
        page?: number;
        pageSize?: number;
      }
    >({
      queryFn: async ({ parentUID, page = 1, pageSize = PAGE_SIZE }) => {
        const searcher = getGrafanaSearcher();

        const dashboardsResults = await searcher.search({
          kind: ['dashboard'],
          query: '*',
          location: parentUID || 'general',
          from: (page - 1) * pageSize, // our pages are 1-indexed, so we need to -1 to convert that to correct value to skip
          limit: pageSize,
        });

        const result = dashboardsResults.view.map((item) => {
          const viewItem = queryResultToViewItem(item, dashboardsResults.view);
          // TODO: Once we remove nestedFolders feature flag, undo this and prevent the 'general'
          // parentUID from being set in searcher
          if (viewItem.parentUID === GENERAL_FOLDER_UID) {
            viewItem.parentUID = undefined;
          }
          return viewItem;
        });

        return { data: result };
      },
      // Only have one cache entry for each parentUID
      serializeQueryArgs: ({ endpointName, queryArgs }) => {
        const { parentUID } = queryArgs;
        return `${endpointName}(${parentUID})`;
      },
      // Merge incoming data to the cache entry
      merge: (currentCache, newItems) => {
        currentCache.push(...newItems);
      },
      // Refetch when the page arg changes
      forceRefetch({ currentArg, previousArg }) {
        return (currentArg && currentArg.page) !== (previousArg && previousArg.page);
      },
    }),
    saveDashboard: builder.mutation<SaveDashboardResponseDTO, SaveDashboardCommand>({
      invalidatesTags: (_result, _error, args) => [{ type: 'getFolderChildren', id: args.folderUid }],
      query: ({ dashboard, folderUid, message, overwrite }) => ({
        url: `/dashboards/db`,
        method: 'POST',
        data: {
          dashboard,
          folderUid,
          message: message ?? '',
          overwrite: Boolean(overwrite),
        },
      }),
    }),
  }),
});

export const {
  endpoints,
  usePrefetch,
  useBulkDeleteMutation,
  useBulkMoveMutation,
  useDeleteFolderMutation,
  useGetAffectedItemsQuery,
  useGetFolderQuery,
  useListDashboardsQuery,
  useListFoldersQuery,
  useMoveFolderMutation,
  useSaveDashboardMutation,
  useSaveFolderMutation,
} = browseDashboardsAPI;
export { skipToken } from '@reduxjs/toolkit/query/react';
