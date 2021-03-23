import { useEffect } from 'react';
import { useAsyncFn } from 'react-use';
import { AppEvents } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { deleteDashboard } from 'app/features/manage-dashboards/state/actions';
import { locationService } from '@grafana/runtime';

export const useDashboardDelete = (uid: string) => {
  const [state, onDeleteDashboard] = useAsyncFn(() => deleteDashboard(uid, false), []);

  useEffect(() => {
    if (state.value) {
      locationService.replace('/');
      appEvents.emit(AppEvents.alertSuccess, ['Dashboard Deleted', state.value.title + ' has been deleted']);
    }
  }, [state]);

  return { state, onDeleteDashboard };
};
