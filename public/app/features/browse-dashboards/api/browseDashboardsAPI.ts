import { createApi } from '@reduxjs/toolkit/query/react';

import { handleRequestError } from '@grafana/api-clients';
import { createBaseQuery } from '@grafana/api-clients/rtkq';
import { invalidateQuotaUsage } from '@grafana/api-clients/rtkq/quotas/v0alpha1';
import { AppEvents, locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { isProvisionedFolderCheck } from 'app/api/clients/folder/v1beta1/utils';
import { appEvents } from 'app/core/app_events';
import { buildNotificationButton } from 'app/core/components/AppNotifications/NotificationButton';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { setStarred, updateDashboardName } from 'app/core/reducers/navBarTree';
import { contextSrv } from 'app/core/services/context_srv';
import { AnnoKeyFolder, type Resource } from 'app/features/apiserver/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { isDashboardV2Resource, isV1DashboardCommand, isV2DashboardCommand } from 'app/features/dashboard/api/utils';
import { type SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { clearDashboardsPageCache } from 'app/features/dashboard-scene/utils/cache';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { TEAM_FOLDERS_UID } from 'app/features/search/constants';
import { dispatch, getState } from 'app/store/store';
import { type SaveDashboardResponseDTO } from 'app/types/dashboard';
import { type FolderDTO } from 'app/types/folders';

import { deletedDashboardsCache } from '../../search/service/deletedDashboardsCache';
import { invalidateVariablesAfterFolderDelete } from '../../variables-management/cache';
import { refetchChildren, refreshParents } from '../state/actions';
import { findItem } from '../state/utils';

import { PAGE_SIZE } from './constants';
import { isProvisionedDashboard } from './isProvisioned';

async function refreshTeamFolders() {
  dispatch(refetchChildren({ parentUID: TEAM_FOLDERS_UID, pageSize: PAGE_SIZE }));
}

interface DeleteFoldersArgs {
  folderUIDs: string[];
}

interface DeleteDashboardsArgs {
  dashboardUIDs: string[];
}

interface MoveDashboardsArgs {
  destinationUID: string;
  dashboardUIDs: string[];
}

interface RestoreDashboardArgs {
  dashboard: Resource<Dashboard | DashboardV2Spec>;
}

const deleteFolderParams = {
  forceDeleteRules: true,
} as const;

export const browseDashboardsAPI = createApi({
  reducerPath: 'browseDashboardsAPI',
  baseQuery: createBaseQuery({ baseURL: '/api' }),
  endpoints: (builder) => ({
    // delete an *individual* folder. used in the folder actions menu.
    deleteFolder: builder.mutation<void, FolderDTO>({
      query: ({ uid }) => ({
        url: `/folders/${uid}`,
        method: 'DELETE',
        params: deleteFolderParams,
      }),
      onQueryStarted: async ({ uid, parentUid }, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          dispatch(refetchChildren({ parentUID: parentUid, pageSize: PAGE_SIZE }));
          refreshTeamFolders();
          invalidateQuotaUsage(dispatch);
          dispatch(setStarred({ id: uid, title: '', url: '', isStarred: false }));
        } catch {
          // Error handled by mutation caller
        } finally {
          // Variables are cascade-deleted before the folder write; a failed DELETE can still drop them.
          invalidateVariablesAfterFolderDelete();
        }
      },
    }),

    // move *multiple* dashboards. used in the move modal.
    moveDashboards: builder.mutation<void, MoveDashboardsArgs>({
      queryFn: async ({ dashboardUIDs, destinationUID }, _api, _extraOptions, baseQuery) => {
        // Move all the dashboards sequentially
        // TODO error handling here
        const api = await getDashboardAPI();
        for (const dashboardUID of dashboardUIDs) {
          const fullDash = await api.getDashboardDTO(dashboardUID);
          const dashboard = isDashboardV2Resource(fullDash) ? fullDash.spec : fullDash.dashboard;
          const k8s = isDashboardV2Resource(fullDash) ? fullDash.metadata : undefined;

          if (config.provisioningEnabled) {
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
          dispatch(refreshParents({ kind: 'dashboard', uids: dashboardUIDs }));
        });
      },
    }),

    // delete *multiple* folders. used in the delete modal.
    deleteFolders: builder.mutation<void, DeleteFoldersArgs>({
      queryFn: async ({ folderUIDs }, api, _extraOptions, baseQuery) => {
        // Delete all the folders sequentially
        // TODO error handling here
        let attempted = 0;
        try {
          for (const folderUID of folderUIDs) {
            if (await isProvisionedFolderCheck(api.dispatch, folderUID)) {
              continue;
            }

            attempted++;
            const response = await baseQuery({
              url: `/folders/${folderUID}`,
              method: 'DELETE',
              params: deleteFolderParams,
            });
            if (!response.error) {
              // Only clear the nav starred entry for folders that were actually deleted
              api.dispatch(setStarred({ id: folderUID, title: '', url: '', isStarred: false }));
            }
          }
        } finally {
          // Variables are cascade-deleted before the folder write, so any attempted DELETE
          // can leave the Variables list stale even when the folder DELETE itself fails.
          if (attempted > 0) {
            invalidateVariablesAfterFolderDelete();
          }
        }

        return { data: undefined };
      },
      onQueryStarted: ({ folderUIDs }, { queryFulfilled, dispatch }) => {
        queryFulfilled.then(() => {
          dispatch(refreshParents({ kind: 'folder', uids: folderUIDs }));
          refreshTeamFolders();
          // Clear the deleted dashboards cache since deleting a folder also deletes its dashboards
          deletedDashboardsCache.clear();
          invalidateQuotaUsage(dispatch);
        });
      },
    }),

    // delete *multiple* dashboards. used in the delete modal.
    deleteDashboards: builder.mutation<void, DeleteDashboardsArgs>({
      queryFn: async ({ dashboardUIDs }) => {
        let deletedCount = 0;
        const deletedDashboardUIDs: string[] = [];
        // Delete all the dashboards sequentially
        // TODO error handling here
        const api = await getDashboardAPI();
        try {
          for (const dashboardUID of dashboardUIDs) {
            // It's not possible to select a mix of provisioned and non-provisioned dashboards
            // from the UI, so this is mostly a guard in case that somehow happens
            if (config.provisioningEnabled) {
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
            await api.deleteDashboard(dashboardUID, false);

            deletedCount++;
            deletedDashboardUIDs.push(dashboardUID);
          }
        } finally {
          if (deletedCount > 0) {
            deletedDashboardsCache.clear();
            clearDashboardsPageCache(deletedDashboardUIDs);

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
          }
        }

        return { data: undefined };
      },
      onQueryStarted: ({ dashboardUIDs }, { queryFulfilled, getState }) => {
        queryFulfilled.then(() => {
          dispatch(refreshParents({ kind: 'dashboard', uids: dashboardUIDs }));
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

      onQueryStarted: (cmd, { queryFulfilled, dispatch }) => {
        const { folderUid, dashboard } = cmd;
        dashboardWatcher.ignoreNextSave();
        const dashboardUid = isV1DashboardCommand(cmd) ? cmd.dashboard.uid : cmd.k8s?.name;

        // Capture the dashboard's previous folder from the cache before save, so that
        // if the user is moving it to a different folder we can invalidate the source
        // folder's children cache. Without this, childrenByParentUID[previousFolderUid]
        // stays stale and folder-select cascades in the list view incorrectly include
        // the moved-out dashboard.
        const previousFolderUid = getDashboardFolder(dashboardUid);

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
          // If the dashboard was moved, also refetch old parent folder
          if (previousFolderUid !== undefined && previousFolderUid !== folderUid) {
            dispatch(
              refetchChildren({
                parentUID: previousFolderUid,
                pageSize: PAGE_SIZE,
              })
            );
          }
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

    // restore a dashboard that got deleted
    restoreDashboard: builder.mutation<{ name: string }, RestoreDashboardArgs>({
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

/**
 * Gets a parent folder of a dashboard from the cache in the store.
 * @param dashboardUid
 */
function getDashboardFolder(dashboardUid?: string) {
  if (dashboardUid) {
    const { browseDashboards } = getState();
    const item = findItem(
      browseDashboards.rootItems?.items ?? [],
      browseDashboards.childrenByParentUID,
      'dashboard',
      dashboardUid
    );
    return item?.parentUID;
  }
  return undefined;
}

export const {
  useDeleteFolderMutation,
  useDeleteFoldersMutation,
  useDeleteDashboardsMutation,
  useMoveDashboardsMutation,
  useSaveDashboardMutation,
  useRestoreDashboardMutation,
} = browseDashboardsAPI;
