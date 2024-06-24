import { useAsyncFn } from 'react-use';

import { locationUtil } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import appEvents from 'app/core/app_events';
import { useAppNotification } from 'app/core/copy/appNotification';
import { updateDashboardName } from 'app/core/reducers/navBarTree';
import { DashboardModel } from 'app/features/dashboard/state';
import { useDispatch } from 'app/types';
import { DashboardSavedEvent } from 'app/types/events';

import { getDashboardAPI } from '../../api/dashboard_api';
import { updateDashboardUidLastUsedDatasource } from '../../utils/dashboard';

import { SaveDashboardCommand, SaveDashboardOptions } from './types';

export const useDashboardSave = (isCopy = false) => {
  const dispatch = useDispatch();
  const notifyApp = useAppNotification();
  const [state, onDashboardSave] = useAsyncFn(
    async (clone: Dashboard, options: SaveDashboardOptions, dashboard: DashboardModel) => {
      try {
        const cmd: SaveDashboardCommand = {
          dashboard: clone,
          folderUid: options.folderUid ?? dashboard.meta.folderUid,
          message: options.message,
          overwrite: options.overwrite,
          k8s: dashboard.meta.k8s, // stashed on load
        }
        // Note in k8s the response does not have URL or slug
        const result = await getDashboardAPI().saveDashboard(cmd);
        console.log("RESULT", result);

        dashboard.version = result.version;

        clone.version = result.version;
        dashboard.clearUnsavedChanges(clone, options);

        // important that these happen before location redirect below
        appEvents.publish(new DashboardSavedEvent());
        notifyApp.success('Dashboard saved');

        //Update local storage dashboard to handle things like last used datasource
        updateDashboardUidLastUsedDatasource(result.uid);

        if (isCopy) {
          reportInteraction('grafana_dashboard_copied', {
            name: dashboard.title,
            url: result.url,
          });
        } else {
          reportInteraction(`grafana_dashboard_${dashboard.uid ? 'saved' : 'created'}`, {
            name: dashboard.title,
            url: result.url,
          });
        }

        const currentPath = locationService.getLocation().pathname;
        const newUrl = locationUtil.stripBaseFromUrl(result.url);

        if (newUrl !== currentPath && result.url) {
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
