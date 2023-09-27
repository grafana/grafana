import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { isTruthy, locationUtil } from '@grafana/data';
import { BackendSrvRequest, getBackendSrv, locationService } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/core';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { DashboardDTO, DescendantCount, DescendantCountDTO, FolderDTO, SaveDashboardResponseDTO } from 'app/types';

import { refetchChildren, refreshParents } from '../state';
import { DashboardTreeSelection } from '../types';

import { PAGE_SIZE } from './services';

interface RequestOptions extends BackendSrvRequest {
  manageError?: (err: unknown) => { error: unknown };
  showErrorAlert?: boolean;
}

interface DeleteItemsArgs {
  selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>;
}

interface MoveItemsArgs extends DeleteItemsArgs {
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
  tagTypes: ['getFolder'],
  reducerPath: 'browseDashboardsAPI',
  baseQuery: createBackendSrvBaseQuery({ baseURL: '/api' }),
  endpoints: (builder) => ({
    // get folder info (e.g. title, parents) but *not* children
    getFolder: builder.query<FolderDTO, string>({
      providesTags: (_result, _error, folderUID) => [{ type: 'getFolder', id: folderUID }],
      query: (folderUID) => ({ url: `/folders/${folderUID}`, params: { accesscontrol: true } }),
    }),
    // create a new folder
    newFolder: builder.mutation<FolderDTO, { title: string; parentUid?: string }>({
      query: ({ title, parentUid }) => ({
        method: 'POST',
        url: '/folders',
        data: {
          title,
          parentUid,
        },
      }),
      onQueryStarted: ({ parentUid }, { queryFulfilled, dispatch }) => {
        queryFulfilled.then(async ({ data: folder }) => {
          await contextSrv.fetchUserPermissions();
          dispatch(notifyApp(createSuccessNotification('Folder created')));
          dispatch(
            refetchChildren({
              parentUID: parentUid,
              pageSize: PAGE_SIZE,
            })
          );
          locationService.push(locationUtil.stripBaseFromUrl(folder.url));
        });
      },
    }),
    // save an existing folder (e.g. rename)
    saveFolder: builder.mutation<FolderDTO, FolderDTO>({
      // because the getFolder calls contain the parents, renaming a parent/grandparent/etc needs to invalidate all child folders
      // we could do something smart and recursively invalidate these child folders but it doesn't seem worth it
      // instead let's just invalidate all the getFolder calls
      invalidatesTags: ['getFolder'],
      query: ({ uid, title, version }) => ({
        method: 'PUT',
        url: `/folders/${uid}`,
        data: {
          title,
          version,
        },
      }),
      onQueryStarted: ({ parentUid }, { queryFulfilled, dispatch }) => {
        queryFulfilled.then(() => {
          dispatch(
            refetchChildren({
              parentUID: parentUid,
              pageSize: PAGE_SIZE,
            })
          );
        });
      },
    }),
    // move an *individual* folder. used in the folder actions menu.
    moveFolder: builder.mutation<void, { folder: FolderDTO; destinationUID: string }>({
      invalidatesTags: ['getFolder'],
      query: ({ folder, destinationUID }) => ({
        url: `/folders/${folder.uid}/move`,
        method: 'POST',
        data: { parentUID: destinationUID },
      }),
      onQueryStarted: ({ folder, destinationUID }, { queryFulfilled, dispatch }) => {
        const { parentUid } = folder;
        queryFulfilled.then(() => {
          dispatch(
            refetchChildren({
              parentUID: parentUid,
              pageSize: PAGE_SIZE,
            })
          );
          dispatch(
            refetchChildren({
              parentUID: destinationUID,
              pageSize: PAGE_SIZE,
            })
          );
        });
      },
    }),
    // delete an *individual* folder. used in the folder actions menu.
    deleteFolder: builder.mutation<void, FolderDTO>({
      query: ({ uid }) => ({
        url: `/folders/${uid}`,
        method: 'DELETE',
        params: {
          // TODO: Once backend returns alert rule counts, set this back to true
          // when this is merged https://github.com/grafana/grafana/pull/67259
          forceDeleteRules: false,
        },
      }),
      onQueryStarted: ({ parentUid }, { queryFulfilled, dispatch }) => {
        queryFulfilled.then(() => {
          dispatch(
            refetchChildren({
              parentUID: parentUid,
              pageSize: PAGE_SIZE,
            })
          );
        });
      },
    }),
    // gets the descendant counts for a folder. used in the move/delete modals.
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
    // move *multiple* items (folders and dashboards). used in the move modal.
    moveItems: builder.mutation<void, MoveItemsArgs>({
      invalidatesTags: ['getFolder'],
      queryFn: async ({ selectedItems, destinationUID }, _api, _extraOptions, baseQuery) => {
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
      onQueryStarted: ({ destinationUID, selectedItems }, { queryFulfilled, dispatch }) => {
        const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
        const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
        queryFulfilled.then(() => {
          dispatch(
            refetchChildren({
              parentUID: destinationUID,
              pageSize: PAGE_SIZE,
            })
          );
          dispatch(refreshParents([...selectedFolders, ...selectedDashboards]));
        });
      },
    }),
    // delete *multiple* items (folders and dashboards). used in the delete modal.
    deleteItems: builder.mutation<void, DeleteItemsArgs>({
      queryFn: async ({ selectedItems }, _api, _extraOptions, baseQuery) => {
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
      onQueryStarted: ({ selectedItems }, { queryFulfilled, dispatch }) => {
        const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
        const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
        queryFulfilled.then(() => {
          dispatch(refreshParents([...selectedFolders, ...selectedDashboards]));
        });
      },
    }),
    // save an existing dashboard
    saveDashboard: builder.mutation<SaveDashboardResponseDTO, SaveDashboardCommand>({
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
      onQueryStarted: ({ folderUid }, { queryFulfilled, dispatch }) => {
        dashboardWatcher.ignoreNextSave();
        queryFulfilled.then(async () => {
          await contextSrv.fetchUserPermissions();
          dispatch(
            refetchChildren({
              parentUID: folderUid,
              pageSize: PAGE_SIZE,
            })
          );
        });
      },
    }),
  }),
});

export const {
  endpoints,
  useDeleteFolderMutation,
  useDeleteItemsMutation,
  useGetAffectedItemsQuery,
  useGetFolderQuery,
  useMoveFolderMutation,
  useMoveItemsMutation,
  useNewFolderMutation,
  useSaveDashboardMutation,
  useSaveFolderMutation,
} = browseDashboardsAPI;
export { skipToken } from '@reduxjs/toolkit/query/react';
