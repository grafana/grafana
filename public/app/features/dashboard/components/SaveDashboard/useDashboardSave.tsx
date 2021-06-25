import { useEffect } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { AppEvents, locationUtil } from '@grafana/data';
import { SaveDashboardOptions } from './types';
import appEvents from 'app/core/app_events';
import { DashboardModel } from 'app/features/dashboard/state';
import { saveDashboard as saveDashboardApiCall } from 'app/features/manage-dashboards/state/actions';
import { locationService } from '@grafana/runtime';
import { DashboardSavedEvent } from 'app/types/events';

const saveDashboard = (saveModel: any, options: SaveDashboardOptions, dashboard: DashboardModel) => {
  let folderId = options.folderId;
  if (folderId === undefined) {
    folderId = dashboard.meta.folderId ?? saveModel.folderId;
  }

  return saveDashboardApiCall({ ...options, folderId, dashboard: saveModel });
};

export const useDashboardSave = (dashboard: DashboardModel) => {
  const [state, onDashboardSave] = useAsyncFn(
    async (clone: any, options: SaveDashboardOptions, dashboard: DashboardModel) =>
      await saveDashboard(clone, options, dashboard),
    []
  );

  useEffect(() => {
    if (state.value) {
      dashboard.version = state.value.version;
      // important that these happen before location redirect below
      appEvents.publish(new DashboardSavedEvent());
      appEvents.emit(AppEvents.alertSuccess, ['Dashboard saved']);

      const currentPath = locationService.getLocation().pathname;
      const newUrl = locationUtil.stripBaseFromUrl(state.value.url);

      if (newUrl !== currentPath) {
        setTimeout(() => locationService.replace(newUrl));
      }
    }
  }, [dashboard, state]);

  return { state, onDashboardSave };
};
