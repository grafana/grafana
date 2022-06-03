import { useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { locationService } from '@grafana/runtime';
import { useAppNotification } from 'app/core/copy/appNotification';
import { deleteDashboard } from 'app/features/manage-dashboards/state/actions';

export const useDashboardDelete = (uid: string, cleanDashboard: () => void) => {
  const [state, onDeleteDashboard] = useAsyncFn(() => deleteDashboard(uid, false), []);
  const notifyApp = useAppNotification();

  useEffect(() => {
    if (state.value) {
      cleanDashboard();
      locationService.replace('/');
      notifyApp.success('Dashboard Deleted', `${state.value.title} has been deleted`);
    }
  }, [state, notifyApp, cleanDashboard]);

  return { state, onDeleteDashboard };
};
