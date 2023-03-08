import { useEffect } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';

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
  const [state, onDashboardSave] = useAsyncFn(
    async (clone: any, options: SaveDashboardOptions, dashboard: DashboardModel) =>
      await saveDashboard(clone, options, dashboard),
    []
  );
  const dispatch = useDispatch();

  const notifyApp = useAppNotification();
  useEffect(() => {
    if (state.error && !state.loading) {
      notifyApp.error(state.error.message ?? 'Error saving dashboard');
    }
    if (state.value) {
      dashboard.version = state.value.version;
      dashboard.clearUnsavedChanges();

      // important that these happen before location redirect below
      appEvents.publish(new DashboardSavedEvent());
      notifyApp.success('Dashboard saved');
      if (isCopy) {
        reportInteraction('grafana_dashboard_copied', {
          name: dashboard.title,
          url: state.value.url,
        });
      } else {
        reportInteraction(`grafana_dashboard_${dashboard.id ? 'saved' : 'created'}`, {
          name: dashboard.title,
          url: state.value.url,
        });
      }

      const currentPath = locationService.getLocation().pathname;
      const newUrl = locationUtil.stripBaseFromUrl(state.value.url);

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
    }
  }, [dashboard, isCopy, state, notifyApp, dispatch]);

  return { state, onDashboardSave };
};
