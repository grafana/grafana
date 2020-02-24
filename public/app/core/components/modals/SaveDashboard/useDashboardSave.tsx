import { SaveDashboardOptions } from './types';
import { DashboardModel } from '../../../../features/dashboard/state';
import { getBackendSrv } from '../../../services/backend_srv';
import { useDispatch, useSelector } from 'react-redux';
import { CoreEvents, StoreState } from '../../../../types';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { useEffect } from 'react';
import appEvents from '../../../app_events';
import { AppEvents } from '@grafana/data';
import locationUtil from '../../../utils/location_util';
import { updateLocation } from '../../../reducers/location';

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
          })
        );
      }
    }
  }, [state]);

  return { state, onDashboardSave };
};
