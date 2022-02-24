import { useEffect } from 'react';
import { useAsyncFn } from 'react-use';
import { useAppNotification } from 'app/core/copy/appNotification';
import { deleteDashboard } from 'app/features/manage-dashboards/state/actions';
import { locationService } from '@grafana/runtime';

export const useDashboardDelete = (uid: string) => {
  const [state, onDeleteDashboard] = useAsyncFn(() => deleteDashboard(uid, false), []);
  const notifyApp = useAppNotification();

  useEffect(() => {
    if (state.value) {
      locationService.replace('/');
      notifyApp.success('Dashboard Deleted', `${state.value.title} has been deleted`);
    }
  }, [state, notifyApp]);

  return { state, onDeleteDashboard };
};
