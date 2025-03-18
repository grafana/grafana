import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { lastValueFrom } from 'rxjs';

import { AppEvents, isTruthy, locationUtil } from '@grafana/data';
import { BackendSrvRequest, getBackendSrv, locationService } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import appEvents from 'app/core/app_events';
import { contextSrv } from 'app/core/core';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import {
  DashboardDTO,
  DescendantCount,
  DescendantCountDTO,
  FolderDTO,
  FolderListItemDTO,
  ImportDashboardResponseDTO,
  PermissionLevelString,
  SaveDashboardResponseDTO,
} from 'app/types';

import { t } from '../../../core/internationalization';
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

export interface ImportInputs {
  name: string;
  type: string;
  value: string;
  pluginId?: string;
}

interface ImportOptions {
  dashboard: Dashboard;
  overwrite: boolean;
  inputs: ImportInputs[];
  folderUid: string;
}

interface RestoreDashboardArgs {
  dashboardUID: string;
  targetFolderUID: string;
}

interface HardDeleteDashboardArgs {
  dashboardUID: string;
}

function createBackendSrvBaseQuery({ baseURL }: { baseURL: string }): BaseQueryFn<RequestOptions> {
  async function backendSrvBaseQuery(requestOptions: RequestOptions) {
    // Suppress error pop-up for root (aka 'general') folder
    const isGeneralFolder = requestOptions.url === `/folders/general`;
    requestOptions = isGeneralFolder ? { ...requestOptions, showErrorAlert: false } : requestOptions;

    try {
      const { data: responseData, ...meta } = await lastValueFrom(
        getBackendSrv().fetch({
          ...requestOptions,
          url: baseURL + requestOptions.url,
        })
      );
      return { data: responseData, meta };
    } catch (error) {
      return requestOptions.manageError ? requestOptions.manageError(error) : { error };
    }
  }

  return backendSrvBaseQuery;
}

export interface ListFolderQueryArgs {
  page: number;
  parentUid: string | undefined;
  limit: number;
  permission?: PermissionLevelString;
}

export const browseDashboardsAPI = createApi({
  tagTypes: ['getFolder'],
  reducerPath: 'browseDashboardsAPI',
  baseQuery: createBackendSrvBaseQuery({ baseURL: '/api' }),
  endpoints: (builder) => ({
    listFolders: builder.query<FolderListItemDTO[], ListFolderQueryArgs>({
      providesTags: (result) => result?.map((folder) => ({ type: 'getFolder', id: folder.uid })) ?? [],
      query: ({ parentUid, limit, page, permission }) => ({
        url: '/folders',
        params: { parentUid, limit, page, permission },
      }),
    }),

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
          dispatch(
            refetchChildren({
              parentUID: parentUid,
              pageSize: PAGE_SIZE,
            })
          );
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
      // don't cache this data for now, since library panel/alert rule creation isn't done through rtk query
      keepUnusedDataFor: 0,
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
          // TODO remove nullish coalescing once nestedFolders is toggled on
          totalCounts.folder += folderCounts.folder ?? 0;
          totalCounts.dashboard += folderCounts.dashboard;
          totalCounts.alertRule += folderCounts.alertrule;
          totalCounts.libraryPanel += folderCounts.librarypanel;
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
          const fullDash: DashboardDTO = await getDashboardAPI().getDashboardDTO(dashboardUID);

          await getDashboardAPI().saveDashboard({
            dashboard: fullDash.dashboard,
            folderUid: destinationUID,
            overwrite: false,
            message: '',
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
          const response = getDashboardAPI().deleteDashboard(dashboardUID, false);

          // @ts-expect-error
          const name = response?.data?.title;

          if (name) {
            appEvents.publish({
              type: AppEvents.alertSuccess.name,
              payload: [
                t('browse-dashboards.soft-delete.success', 'Dashboard {{name}} moved to Recently deleted', { name }),
              ],
            });
          }
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
      queryFn: async (cmd) => {
        try {
          const rsp = await getDashboardAPI().saveDashboard(cmd);
          return { data: rsp };
        } catch (error) {
          return { error };
        }
      },

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

    importDashboard: builder.mutation<ImportDashboardResponseDTO, ImportOptions>({
      query: ({ dashboard, overwrite, inputs, folderUid }) => ({
        method: 'POST',
        url: '/dashboards/import',
        data: {
          dashboard,
          overwrite,
          inputs,
          folderUid,
        },
      }),
      onQueryStarted: ({ folderUid }, { queryFulfilled, dispatch }) => {
        queryFulfilled.then(async (response) => {
          dispatch(
            refetchChildren({
              parentUID: folderUid,
              pageSize: PAGE_SIZE,
            })
          );
          const dashboardUrl = locationUtil.stripBaseFromUrl(response.data.importedUrl);
          locationService.push(dashboardUrl);
        });
      },
    }),

    // restore a dashboard that got soft deleted
    restoreDashboard: builder.mutation<void, RestoreDashboardArgs>({
      query: ({ dashboardUID, targetFolderUID }) => ({
        url: `/dashboards/uid/${dashboardUID}/trash`,
        data: {
          folderUid: targetFolderUID,
        },
        method: 'PATCH',
      }),
    }),

    // permanently delete a dashboard. used in PermanentlyDeleteModal.
    hardDeleteDashboard: builder.mutation<void, HardDeleteDashboardArgs>({
      queryFn: async ({ dashboardUID }, _api, _extraOptions, baseQuery) => {
        const response = await baseQuery({
          url: `/dashboards/uid/${dashboardUID}/trash`,
          method: 'DELETE',
          showSuccessAlert: false,
        });

        // @ts-expect-error
        const name = response?.data?.title;

        if (name) {
          appEvents.publish({
            type: AppEvents.alertSuccess.name,
            payload: [t('browse-dashboards.hard-delete.success', 'Dashboard {{name}} deleted', { name })],
          });
        }

        return { data: undefined };
      },
      onQueryStarted: ({ dashboardUID }, { queryFulfilled, dispatch }) => {
        queryFulfilled.then(() => {
          dispatch(refreshParents([dashboardUID]));
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
  useRestoreDashboardMutation,
  useHardDeleteDashboardMutation,
} = browseDashboardsAPI;

export { skipToken } from '@reduxjs/toolkit/query/react';
