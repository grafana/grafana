import { useEffect } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { AppEvents, locationUtil } from '@grafana/data';
import { useDispatch, useSelector } from 'react-redux';
import { SaveDashboardOptions } from './types';
import { CoreEvents, StoreState } from 'app/types';
import appEvents from 'app/core/app_events';
import { updateLocation } from 'app/core/reducers/location';
import { DashboardModel } from 'app/features/dashboard/state';
import { getBackendSrv } from 'app/core/services/backend_srv';

const saveDashboard = async (saveModel: any, options: SaveDashboardOptions, dashboard: DashboardModel) => {
  const folderId = options.folderId >= 0 ? options.folderId : dashboard.meta.folderId || saveModel.folderId;
  return await getBackendSrv().saveDashboard(saveModel, { ...options, folderId });
};

export const useDashboardSave = (dashboard: DashboardModel) => {
  const location = useSelector((state: StoreState) => state.location);
  const dispatch = useDispatch();
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
        dispatch(
          updateLocation({
            path: newUrl,
            replace: true,
            query: {},
          })
        );
      }
    }
  }, [state]);

  return { state, onDashboardSave };
};
