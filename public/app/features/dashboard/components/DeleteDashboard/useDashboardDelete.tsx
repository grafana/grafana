import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useAsyncFn } from 'react-use';
import { AppEvents } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { updateLocation } from 'app/core/reducers/location';
import { StoreState } from 'app/types';
import { deleteDashboard } from 'app/features/manage-dashboards/state/actions';

export const useDashboardDelete = (uid: string) => {
  const dashboard = useSelector((state: StoreState) => state.dashboard.getModel());
  const dispatch = useDispatch();
  const [state, onRestoreDashboard] = useAsyncFn(async () => deleteDashboard(uid, false), []);
  useEffect(() => {
    if (state.value) {
      dispatch(
        updateLocation({
          path: '/',
          replace: true,
          query: {},
        })
      );
      appEvents.emit(AppEvents.alertSuccess, ['Dashboard Deleted', dashboard!.title + ' has been deleted']);
    }
  }, [state]);
  return { state, onRestoreDashboard };
};
