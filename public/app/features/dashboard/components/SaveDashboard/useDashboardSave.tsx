import { useAsyncFn } from 'react-use';

import { locationUtil } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/core';
import { updateDashboardName } from 'app/core/reducers/navBarTree';
import { DashboardModel } from 'app/features/dashboard/state';
import { saveDashboard as saveDashboardApiCall } from 'app/features/manage-dashboards/state/actions';
import { useDispatch } from 'app/types';
import { DashboardSavedEvent } from 'app/types/events';

import { SaveDashboardOptions } from './types';

const saveDashboard = async (saveModel: any, options: SaveDashboardOptions, dashboard: DashboardModel) => {
  let folderUid = options.folderUid;
  if (folderUid === undefined) {
    folderUid = dashboard.meta.folderUid ?? saveModel.folderUid;
  }

  const result = await saveDashboardApiCall({ ...options, folderUid, dashboard: saveModel });
  // fetch updated access control permissions
  await contextSrv.fetchUserPermissions();
  return result;
};

export const useDashboardSave = (dashboard: DashboardModel, isCopy = false) => {
  const dispatch = useDispatch();
  const notifyApp = useAppNotification();
  const [state, onDashboardSave] = useAsyncFn(
    async (clone: any, options: SaveDashboardOptions, dashboard: DashboardModel) => {
      try {
        const result = await saveDashboard(clone, options, dashboard);
        dashboard.version = result.version;
        dashboard.clearUnsavedChanges();

        // important that these happen before location redirect below
        appEvents.publish(new DashboardSavedEvent());
        notifyApp.success('Dashboard saved');
        if (isCopy) {
          reportInteraction('grafana_dashboard_copied', {
            name: dashboard.title,
            url: result.url,
          });
        } else {
          reportInteraction(`grafana_dashboard_${dashboard.id ? 'saved' : 'created'}`, {
            name: dashboard.title,
            url: result.url,
          });
        }

        const currentPath = locationService.getLocation().pathname;
        const newUrl = locationUtil.stripBaseFromUrl(result.url);

        if (newUrl !== currentPath) {
          setTimeout(() => locationService.replace(newUrl));
        }
        if (dashboard.meta.isStarred) {
          dispatch(
            updateDashboardName({
              id: dashboard.uid,
              title: dashboard.title,
              url: newUrl,
            })
          );
        }
        return result;
      } catch (error) {
        if (error instanceof Error) {
          notifyApp.error(error.message ?? 'Error saving dashboard');
        }
        throw error;
      }
    },
    [dispatch, notifyApp]
  );

  return { state, onDashboardSave };
};
