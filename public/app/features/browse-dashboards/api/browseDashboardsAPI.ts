import { createApi } from '@reduxjs/toolkit/query/react';

import { handleRequestError } from '@grafana/api-clients';
import { generatedAPI as legacyUserAPI } from '@grafana/api-clients/internal/rtkq/legacy/user';
import { createBaseQuery } from '@grafana/api-clients/rtkq';
import { invalidateQuotaUsage } from '@grafana/api-clients/rtkq/quotas/v0alpha1';
import { AppEvents } from '@grafana/data/types';
import { locationUtil } from '@grafana/data/utils';
import { t } from '@grafana/i18n';
import { config, getBackendSrv, isFetchError, locationService } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { isProvisionedFolderCheck } from 'app/api/clients/folder/v1beta1/utils';
import { appEvents } from 'app/core/app_events';
import { buildNotificationButton } from 'app/core/components/AppNotifications/NotificationButton';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { setStarred, updateDashboardName } from 'app/core/reducers/navBarTree';
import { contextSrv } from 'app/core/services/context_srv';
import { AnnoKeyFolder, type Resource, type ResourceList } from 'app/features/apiserver/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { isDashboardV2Resource, isV1DashboardCommand, isV2DashboardCommand } from 'app/features/dashboard/api/utils';
import { type SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { dispatch } from 'app/store/store';
import { type PermissionLevel } from 'app/types/acl';
import { type ImportDashboardResponseDTO, type SaveDashboardResponseDTO } from 'app/types/dashboard';
import {
  type DescendantCount,
  type DescendantCountDTO,
  type FolderDTO,
  type FolderListItemDTO,
} from 'app/types/folders';

import { getDashboardScenePageStateManager } from '../../dashboard-scene/pages/DashboardScenePageStateManager';
import { deletedDashboardsCache } from '../../search/service/deletedDashboardsCache';
import { refetchChildren, refreshParents } from '../state/actions';

import { isProvisionedDashboard } from './isProvisioned';
import { PAGE_SIZE } from './services';

export interface DeleteFoldersArgs {
  folderUIDs: string[];
}

interface DeleteDashboardsArgs {
  dashboardUIDs: string[];
}

interface MoveDashboardsArgs {
  destinationUID: string;
  dashboardUIDs: string[];
}

export interface MoveFoldersArgs {
  destinationUID: string;
  folderUIDs: string[];
}

export interface MoveFolderArgs {
  folderUID: string;
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
  dashboard: Resource<Dashboard | DashboardV2Spec>;
}

// We need to do this as the API will return different responses depending on the type of storage used and existing
// resource types, even when we are using the old api/ endpoint.
const normalizeDescendantCounts = (folderCounts: DescendantCountDTO): DescendantCount => ({
  folders: folderCounts.folders ?? folderCounts.folder ?? 0,
  dashboards: folderCounts.dashboards ?? folderCounts.dashboard ?? 0,
  library_elements: folderCounts.library_elements ?? folderCounts.librarypanel ?? 0,
  alertrules: folderCounts.alertrules ?? folderCounts.alertrule ?? 0,
});

export interface ListFolderQueryArgs {
  page: number;
  parentUid: string | undefined;
  limit: number;
  permission?: PermissionLevel;
}

const folderListTag = { type: 'getFolder' as const, id: 'LIST' };
const invalidateFolderListOnSuccess = (_result: unknown, error: unknown) => (error ? [] : [folderListTag]);

// TODO: Once backend returns alert rule counts, set this back to true
// when this is merged https://github.com/grafana/grafana/pull/67259
const deleteFolderParams = {
  forceDeleteRules: false,
} as const;

export const browseDashboardsAPI = createApi({
  tagTypes: ['getFolder'],
  reducerPath: 'browseDashboardsAPI',
  baseQuery: createBaseQuery({ baseURL: '/api' }),
  endpoints: (builder) => ({
    listFolders: builder.query<FolderListItemDTO[], ListFolderQueryArgs>({
      providesTags: (result) =>
        result && result.length > 0
          ? [folderListTag, ...result.map((folder) => ({ type: 'getFolder' as const, id: folder.uid }))]
          : [folderListTag],
      query: ({ parentUid, limit, page, permission }) => ({
        url: '/folders',
        params: { parentUid, limit, page, permission },
      }),
    }),

    // get folder info (e.g. title, parents) but *not* children
    getFolder: builder.query<FolderDTO, { folderUID: string; accesscontrol: boolean; isLegacyCall: boolean }>({
      providesTags: (_result, _error, { folderUID }) => [{ type: 'getFolder', id: folderUID }],
      query: ({ folderUID, accesscontrol, isLegacyCall }) => ({
        url: `/folders/${folderUID}`,
        params: {
          accesscontrol,
          // Add additional query param so we can tell when
          // this was called for app platform compatibility purposes vs. actually needing to use the legacy API
          isLegacyCall,
        },
      }),
    }),

    // create a new folder
    newFolder: builder.mutation<FolderDTO, { title: string; parentUid?: string }>({
      invalidatesTags: ['getFolder'],
      query: ({ title, parentUid }) => ({
        method: 'POST',
        url: '/folders',
        body: {
          title,
          parentUid,
        },
      }),
      onQueryStarted: async ({ parentUid }, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
        } catch {
          return; // Error handled by mutation caller
        }
        dispatch(
          refetchChildren({
            parentUID: parentUid,
            pageSize: PAGE_SIZE,
          })
        );
        // Refetch quota usage after mutations that change the total number of dashboards or folders
        invalidateQuotaUsage(dispatch);
      },
    }),

    // save an existing folder (e.g. rename)
    saveFolder: builder.mutation<FolderDTO, Pick<FolderDTO, 'uid' | 'title' | 'version' | 'parentUid'>>({
      // because the getFolder calls contain the parents, renaming a parent/grandparent/etc needs to invalidate all child folders
      // we could do something smart and recursively invalidate these child folders but it doesn't seem worth it
      // instead let's just invalidate all the getFolder calls
      invalidatesTags: ['getFolder'],
      query: ({ uid, title, version }) => ({
        method: 'PUT',
        url: `/folders/${uid}`,
        body: {
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
    moveFolder: builder.mutation<void, MoveFolderArgs>({
      invalidatesTags: ['getFolder'],
      query: ({ folderUID, destinationUID }) => ({
        url: `/folders/${folderUID}/move`,
        method: 'POST',
        body: { parentUID: destinationUID },
      }),
      onQueryStarted: ({ folderUID, destinationUID }, { queryFulfilled, dispatch }) => {
        queryFulfilled.then(() => {
          dispatch(refreshParents([folderUID]));
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
      invalidatesTags: invalidateFolderListOnSuccess,
      query: ({ uid }) => ({
        url: `/folders/${uid}`,
        method: 'DELETE',
        params: deleteFolderParams,
      }),
      onQueryStarted: async ({ uid, parentUid }, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          dispatch(refetchChildren({ parentUID: parentUid, pageSize: PAGE_SIZE }));
          invalidateQuotaUsage(dispatch);
        } catch {
          // Error handled by mutation caller
        }
      },
    }),

    // gets the descendant counts for a folder. used in the move/delete modals.
    getAffectedItems: builder.query<DescendantCount, { folderUIDs: string[]; dashboardUIDs: string[] }>({
      // don't cache this data for now, since library panel/alert rule creation isn't done through rtk query
      keepUnusedDataFor: 0,
      queryFn: async ({ folderUIDs, dashboardUIDs }) => {
        try {
          const promises = folderUIDs.map((folderUID) => {
            return getBackendSrv().get<DescendantCountDTO>(`/api/folders/${folderUID}/counts`);
          });
          const results = await Promise.all(promises);

          const totalCounts: DescendantCount = {
            folders: folderUIDs.length,
            dashboards: dashboardUIDs.length,
            library_elements: 0,
            alertrules: 0,
          };

          for (const folderCounts of results) {
            const normalizedCounts = normalizeDescendantCounts(folderCounts);
            totalCounts.folders += normalizedCounts.folders;
            totalCounts.dashboards += normalizedCounts.dashboards;
            totalCounts.alertrules += normalizedCounts.alertrules;
            totalCounts.library_elements += normalizedCounts.library_elements;
          }

          return { data: totalCounts };
        } catch (error) {
          return { error };
        }
      },
    }),

    // move *multiple* dashboards. used in the move modal.
    moveDashboards: builder.mutation<void, MoveDashboardsArgs>({
      invalidatesTags: ['getFolder'],
      queryFn: async ({ dashboardUIDs, destinationUID }, _api, _extraOptions, baseQuery) => {
        // Move all the dashboards sequentially
        // TODO error handling here
        const api = await getDashboardAPI();
        for (const dashboardUID of dashboardUIDs) {
          const fullDash = await api.getDashboardDTO(dashboardUID);
          const dashboard = isDashboardV2Resource(fullDash) ? fullDash.spec : fullDash.dashboard;
          const k8s = isDashboardV2Resource(fullDash) ? fullDash.metadata : undefined;

          if (config.featureToggles.provisioning) {
            if (isProvisionedDashboard(fullDash)) {
              appEvents.publish({
                type: AppEvents.alertWarning.name,
                payload: ['Cannot move provisioned dashboard'],
              });
              continue;
            }
          }
          await api.saveDashboard({
            dashboard,
            folderUid: destinationUID,
            overwrite: false,
            message: '',
            k8s,
          });
        }
        return { data: undefined };
      },
      onQueryStarted: ({ destinationUID, dashboardUIDs }, { queryFulfilled, dispatch }) => {
        queryFulfilled.then(() => {
          dispatch(
            refetchChildren({
              parentUID: destinationUID,
              pageSize: PAGE_SIZE,
            })
          );
          dispatch(refreshParents(dashboardUIDs));
        });
      },
    }),

    // move *multiple* folders. used in the move modal.
    moveFolders: builder.mutation<void, MoveFoldersArgs>({
      invalidatesTags: ['getFolder'],
      queryFn: async ({ folderUIDs, destinationUID }, _api, _extraOptions, baseQuery) => {
        // Move all the folders sequentially
        // TODO error handling here
        for (const folderUID of folderUIDs) {
          if (
            await isProvisionedFolderCheck(dispatch, folderUID, {
              warning: t(
                'folders.api.folder-move-error-provisioned',
                'Cannot move provisioned folder. To move it, move it in the repository and synchronise to apply the changes.'
              ),
            })
          ) {
            continue;
          }

          await baseQuery({
            url: `/folders/${folderUID}/move`,
            method: 'POST',
            body: { parentUID: destinationUID },
          });
        }

        return { data: undefined };
      },
      onQueryStarted: ({ destinationUID, folderUIDs }, { queryFulfilled, dispatch }) => {
        queryFulfilled.then(() => {
          dispatch(
            refetchChildren({
              parentUID: destinationUID,
              pageSize: PAGE_SIZE,
            })
          );
          dispatch(refreshParents(folderUIDs));
        });
      },
    }),

    // delete *multiple* folders. used in the delete modal.
    deleteFolders: builder.mutation<void, DeleteFoldersArgs>({
      invalidatesTags: invalidateFolderListOnSuccess,
      queryFn: async ({ folderUIDs }, api, _extraOptions, baseQuery) => {
        // Delete all the folders sequentially
        // TODO error handling here
        for (const folderUID of folderUIDs) {
          if (await isProvisionedFolderCheck(api.dispatch, folderUID)) {
            continue;
          }

          await baseQuery({
            url: `/folders/${folderUID}`,
            method: 'DELETE',
            params: deleteFolderParams,
          });
        }

        return { data: undefined };
      },
      onQueryStarted: ({ folderUIDs }, { queryFulfilled, dispatch }) => {
        queryFulfilled.then(() => {
          dispatch(refreshParents(folderUIDs));
          // Clear the deleted dashboards cache since deleting a folder also deletes its dashboards
          deletedDashboardsCache.clear();
          invalidateQuotaUsage(dispatch);
        });
      },
    }),

    // delete *multiple* dashboards. used in the delete modal.
    deleteDashboards: builder.mutation<void, DeleteDashboardsArgs>({
      invalidatesTags: invalidateFolderListOnSuccess,
      queryFn: async ({ dashboardUIDs }) => {
        const pageStateManager = getDashboardScenePageStateManager();
        const restoreDashboardsEnabled = config.featureToggles.restoreDashboards;
        let deletedCount = 0;
        const deletedDashboardUIDs: string[] = [];
        // Delete all the dashboards sequentially
        // TODO error handling here
        const api = await getDashboardAPI();
        try {
          for (const dashboardUID of dashboardUIDs) {
            // It's not possible to select a mix of provisioned and non-provisioned dashboards
            // from the UI, so this is mostly a guard in case that somehow happens
            if (config.featureToggles.provisioning) {
              const dto = await api.getDashboardDTO(dashboardUID);
              if (isProvisionedDashboard(dto)) {
                appEvents.publish({
                  type: AppEvents.alertWarning.name,
                  payload: [
                    'Cannot delete provisioned dashboard. To remove it, delete it from the repository and synchronise to apply the changes.',
                  ],
                });
                continue;
              }
            }
            await api.deleteDashboard(dashboardUID, !restoreDashboardsEnabled);

            deletedCount++;
            deletedDashboardUIDs.push(dashboardUID);
          }
        } finally {
          if (deletedCount > 0) {
            pageStateManager.clearDashboardCache();
            deletedDashboardsCache.clear();
            for (const uid of deletedDashboardUIDs) {
              pageStateManager.removeSceneCache(uid);
            }

            // Show success notification after all deletions
            if (restoreDashboardsEnabled) {
              // Show notification with button to Recently Deleted
              const title =
                deletedCount === 1
                  ? t('browse-dashboards.delete.success-single', 'Dashboard deleted')
                  : t('browse-dashboards.delete.success-multiple', 'Dashboards deleted');
              const buttonText = t('browse-dashboards.delete.view-recently-deleted', 'View deleted dashboards');
              const component = buildNotificationButton({
                title,
                buttonLabel: buttonText,
                href: config.appSubUrl + '/dashboard/recently-deleted',
              });
              dispatch(notifyApp(createSuccessNotification('', '', undefined, component)));
            } else if (config.featureToggles.kubernetesDashboards) {
              // Legacy notification for kubernetes dashboards
              appEvents.publish({
                type: AppEvents.alertSuccess.name,
                payload: ['Dashboard deleted'],
              });
            }
          }
        }

        return { data: undefined };
      },
      onQueryStarted: ({ dashboardUIDs }, { queryFulfilled, getState }) => {
        queryFulfilled.then(() => {
          dispatch(refreshParents(dashboardUIDs));
          dispatch(legacyUserAPI.util.invalidateTags(['dashboardStars']));
          invalidateQuotaUsage(dispatch);
          for (const uid of dashboardUIDs) {
            dispatch(
              setStarred({
                id: uid,
                // We don't need to send the title or url as we're removing the starred items here
                title: '',
                url: '',
                isStarred: false,
              })
            );
          }
        });
      },
    }),

    // save an existing dashboard
    saveDashboard: builder.mutation<SaveDashboardResponseDTO, SaveDashboardCommand<Dashboard | DashboardV2Spec>>({
      queryFn: async (cmd) => {
        try {
          if (isV2DashboardCommand(cmd)) {
            const api = await getDashboardAPI('v2');
            const response = await api.saveDashboard(cmd);
            return { data: response };
          }

          if (isV1DashboardCommand(cmd)) {
            const api = await getDashboardAPI('v1');
            const rsp = await api.saveDashboard(cmd);
            return { data: rsp };
          }
          throw new Error('Invalid dashboard version');
        } catch (error) {
          return handleRequestError(error);
        }
      },

      onQueryStarted: ({ folderUid, dashboard }, { queryFulfilled, dispatch }) => {
        dashboardWatcher.ignoreNextSave();
        queryFulfilled.then(async ({ data }) => {
          try {
            await contextSrv.fetchUserPermissions();
          } catch (err) {
            console.error('Failed to refresh user permissions after save', err);
          }
          dispatch(
            refetchChildren({
              parentUID: folderUid,
              pageSize: PAGE_SIZE,
            })
          );
          // version 1 means a newly created dashboard — only then does the resource count change
          if (data.version === 1) {
            invalidateQuotaUsage(dispatch);
          }
          // Update starred dashboard name in nav sidebar (no-ops if dashboard isn't starred)
          const title = dashboard.title;
          if (title && data.url) {
            const url = locationUtil.stripBaseFromUrl(data.url);
            dispatch(updateDashboardName({ id: data.uid, title, url }));
          }
        });
      },
    }),

    importDashboard: builder.mutation<ImportDashboardResponseDTO, ImportOptions>({
      query: ({ dashboard, overwrite, inputs, folderUid }) => ({
        method: 'POST',
        url: '/dashboards/import',
        body: {
          dashboard,
          overwrite,
          inputs,
          folderUid,
        },
      }),
      onQueryStarted: async ({ dashboard, folderUid }, { queryFulfilled, dispatch }) => {
        // Check if a dashboard with this UID already exists to find its current folder
        let currentFolderUid: string | undefined;
        if (dashboard.uid) {
          try {
            const api = await getDashboardAPI();
            const existingDashboard = await api.getDashboardDTO(dashboard.uid);
            currentFolderUid = isDashboardV2Resource(existingDashboard)
              ? existingDashboard.metadata?.name
              : existingDashboard.meta?.folderUid;
          } catch (error) {
            if (isFetchError(error)) {
              if (error.status !== 404) {
                console.error('Error fetching dashboard', error);
              } else {
                // Do not show the error alert if the dashboard does not exist
                // this is expected when importing a new dashboard
                error.isHandled = true;
              }
            }
          }
        }

        queryFulfilled.then(async (response) => {
          // Refresh destination folder
          dispatch(
            refetchChildren({
              parentUID: folderUid,
              pageSize: PAGE_SIZE,
            })
          );

          // If the dashboard was moved from a different folder, refresh the source folder too
          if (currentFolderUid && currentFolderUid !== folderUid) {
            dispatch(
              refetchChildren({
                parentUID: currentFolderUid,
                pageSize: PAGE_SIZE,
              })
            );
          }

          const dashboardUrl = locationUtil.stripBaseFromUrl(response.data.importedUrl);
          locationService.push(dashboardUrl);
          invalidateQuotaUsage(dispatch);
        });
      },
    }),

    // RTK wrapper for the dashboard API
    listDeletedDashboards: builder.query<ResourceList<Dashboard | DashboardV2Spec>, void>({
      providesTags: ['getFolder'],
      queryFn: async () => {
        try {
          const api = await getDashboardAPI();
          const response = await api.listDeletedDashboards({});

          return { data: response };
        } catch (error) {
          return handleRequestError(error);
        }
      },
    }),

    // restore a dashboard that got deleted
    restoreDashboard: builder.mutation<{ name: string }, RestoreDashboardArgs>({
      invalidatesTags: ['getFolder'],
      queryFn: async ({ dashboard }) => {
        try {
          const api = await getDashboardAPI();
          const response = await api.restoreDashboard(dashboard);
          const name = response.spec.title || '';
          const parentFolder = response.metadata?.annotations?.[AnnoKeyFolder];

          // Refresh the contents of the folder a dashboard was restored to
          dispatch(
            refetchChildren({
              parentUID: parentFolder,
              pageSize: PAGE_SIZE,
            })
          );
          invalidateQuotaUsage(dispatch);

          return { data: { name } };
        } catch (error) {
          return handleRequestError(error);
        }
      },
    }),
  }),
});

export const {
  endpoints,
  useDeleteFolderMutation,
  useDeleteFoldersMutation,
  useDeleteDashboardsMutation,
  useGetAffectedItemsQuery,
  useGetFolderQuery,
  useLazyGetFolderQuery,
  useMoveFolderMutation,
  useMoveDashboardsMutation,
  useMoveFoldersMutation,
  useNewFolderMutation,
  useSaveDashboardMutation,
  useSaveFolderMutation,
  useRestoreDashboardMutation,
  useListDeletedDashboardsQuery,
} = browseDashboardsAPI;
