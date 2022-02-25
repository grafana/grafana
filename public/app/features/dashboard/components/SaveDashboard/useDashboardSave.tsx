import { useEffect } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { locationUtil } from '@grafana/data';
import { SaveDashboardOptions } from './types';
import appEvents from 'app/core/app_events';
import { contextSrv } from 'app/core/core';
import { useAppNotification } from 'app/core/copy/appNotification';
import { DashboardModel } from 'app/features/dashboard/state';
import { saveDashboard as saveDashboardApiCall } from 'app/features/manage-dashboards/state/actions';
import { locationService, reportInteraction } from '@grafana/runtime';
import { DashboardSavedEvent } from 'app/types/events';

const saveDashboard = async (saveModel: any, options: SaveDashboardOptions, dashboard: DashboardModel) => {
  let folderId = options.folderId;
  if (folderId === undefined) {
    folderId = dashboard.meta.folderId ?? saveModel.folderId;
  }

  const result = await saveDashboardApiCall({ ...options, folderId, dashboard: saveModel });
  // fetch updated access control permissions
  await contextSrv.fetchUserPermissions();
  return result;
};

export const useDashboardSave = (dashboard: DashboardModel) => {
  const [state, onDashboardSave] = useAsyncFn(
    async (clone: any, options: SaveDashboardOptions, dashboard: DashboardModel) =>
      await saveDashboard(clone, options, dashboard),
    []
  );

  const notifyApp = useAppNotification();
  useEffect(() => {
    if (state.value) {
      dashboard.version = state.value.version;
      dashboard.clearUnsavedChanges();

      // important that these happen before location redirect below
      appEvents.publish(new DashboardSavedEvent());
      notifyApp.success('Dashboard saved');
      reportInteraction(`Dashboard ${dashboard.id ? 'saved' : 'created'}`, {
        name: dashboard.title,
        url: state.value.url,
      });

      const currentPath = locationService.getLocation().pathname;
      const newUrl = locationUtil.stripBaseFromUrl(state.value.url);

      if (newUrl !== currentPath) {
        setTimeout(() => locationService.replace(newUrl));
      }
    }
  }, [dashboard, state, notifyApp]);

  return { state, onDashboardSave };
};
