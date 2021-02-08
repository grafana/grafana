import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useAsyncFn } from 'react-use';
import { AppEvents } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { updateLocation } from 'app/core/reducers/location';
import { deleteDashboard } from 'app/features/manage-dashboards/state/actions';

export const useDashboardDelete = (uid: string) => {
  const dispatch = useDispatch();
  const [state, onRestoreDashboard] = useAsyncFn(() => deleteDashboard(uid, false), []);
  useEffect(() => {
    if (state.value) {
      dispatch(
        updateLocation({
          path: '/',
          replace: true,
          query: {},
        })
      );
      appEvents.emit(AppEvents.alertSuccess, ['Dashboard Deleted', state.value.title + ' has been deleted']);
    }
  }, [state]);
  return { state, onRestoreDashboard };
};
