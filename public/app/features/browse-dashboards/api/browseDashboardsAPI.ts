import { BaseQueryFn, createApi, TagDescription } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { isTruthy } from '@grafana/data';
import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { getFolderChildren } from 'app/features/search/service/folders';
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

interface BulkDeleteArgs {
  selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>;
  rootItems: DashboardViewItem[] | undefined;
  childrenByParentUID: Record<string, DashboardViewItemCollection | undefined>;
}

interface BulkMoveArgs extends BulkDeleteArgs {
  destinationUID: string;
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
    bulkDelete: builder.mutation<void, BulkDeleteArgs>({
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
    bulkMove: builder.mutation<void, BulkMoveArgs>({
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
    getFolderChildren: builder.query<DashboardViewItem[], string>({
      providesTags: (_result, _error, arg) => [{ type: 'getFolderChildren', id: arg }],
      queryFn: async (folderUID) => {
        const children = await getFolderChildren(folderUID, undefined, true);
        return {
          data: children,
        };
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
  useMoveFolderMutation,
  useSaveDashboardMutation,
  useSaveFolderMutation,
} = browseDashboardsAPI;
export { skipToken } from '@reduxjs/toolkit/query/react';
