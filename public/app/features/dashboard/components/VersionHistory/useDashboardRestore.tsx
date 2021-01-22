import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useAsyncFn } from 'react-use';
import { AppEvents, locationUtil } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { updateLocation } from 'app/core/reducers/location';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { StoreState } from 'app/types';
import { historySrv } from './HistorySrv';
import { DashboardModel } from '../../state';

const restoreDashboard = async (version: number, dashboard: DashboardModel) => {
  return await historySrv.restoreDashboard(dashboard, version);
};

export const useDashboardRestore = (version: number) => {
  const dashboard = useSelector((state: StoreState) => state.dashboard.getModel());
  const dispatch = useDispatch();
  const [state, onRestoreDashboard] = useAsyncFn(async () => await restoreDashboard(version, dashboard!), []);
  useEffect(() => {
    if (state.value) {
      const newUrl = locationUtil.stripBaseFromUrl(state.value.url);
      dispatch(
        updateLocation({
          path: newUrl,
          replace: true,
          query: {},
        })
      );
      dashboardWatcher.reloadPage();
      appEvents.emit(AppEvents.alertSuccess, ['Dashboard restored', 'Restored from version ' + version]);
    }
  }, [state]);
  return { state, onRestoreDashboard };
};
