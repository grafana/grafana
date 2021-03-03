import { useEffect } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { AppEvents, locationUtil } from '@grafana/data';
import { useSelector } from 'react-redux';
import { SaveDashboardOptions } from './types';
import { CoreEvents, StoreState } from 'app/types';
import appEvents from 'app/core/app_events';
import { DashboardModel } from 'app/features/dashboard/state';
import { saveDashboard as saveDashboardApiCall } from 'app/features/manage-dashboards/state/actions';
import { locationService } from '@grafana/runtime';

const saveDashboard = (saveModel: any, options: SaveDashboardOptions, dashboard: DashboardModel) => {
  let folderId = options.folderId;
  if (folderId === undefined) {
    folderId = dashboard.meta.folderId ?? saveModel.folderId;
  }

  return saveDashboardApiCall({ ...options, folderId, dashboard: saveModel });
};

export const useDashboardSave = (dashboard: DashboardModel) => {
  const location = useSelector((state: StoreState) => state.location);
  const [state, onDashboardSave] = useAsyncFn(
    async (clone: any, options: SaveDashboardOptions, dashboard: DashboardModel) =>
      await saveDashboard(clone, options, dashboard),
    []
  );

  useEffect(() => {
    if (state.value) {
      dashboard.version = state.value.version;

      // important that these happen before location redirect below
      appEvents.emit(CoreEvents.dashboardSaved, dashboard);
      appEvents.emit(AppEvents.alertSuccess, ['Dashboard saved']);

      const newUrl = locationUtil.stripBaseFromUrl(state.value.url);
      const currentPath = location.path;

      if (newUrl !== currentPath) {
        locationService.push(newUrl);
      }
    }
  }, [state]);

  return { state, onDashboardSave };
};
