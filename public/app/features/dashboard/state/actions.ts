import { TimeZone } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { WeekStart } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { removeAllPanels } from 'app/features/panel/state/reducers';
import { updateTimeZoneForSession, updateWeekStartForSession } from 'app/features/profile/state/reducers';
import { ThunkResult } from 'app/types/store';

import { loadPluginDashboards } from '../../plugins/admin/state/actions';
import { cancelVariables } from '../../variables/state/actions';
import { getDashboardSrv } from '../services/DashboardSrv';
import { getTimeSrv } from '../services/TimeSrv';

import { cleanUpDashboard } from './reducers';

export function importDashboard(data: any, dashboardTitle: string): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().post('/api/dashboards/import', data);
    dispatch(notifyApp(createSuccessNotification('Dashboard Imported', dashboardTitle)));
    dispatch(loadPluginDashboards());
  };
}

export function removeDashboard(uid: string): ThunkResult<void> {
  return async (dispatch) => {
    await getDashboardAPI().deleteDashboard(uid, false);
    dispatch(loadPluginDashboards());
  };
}

export const cleanUpDashboardAndVariables = (): ThunkResult<void> => (dispatch, getStore) => {
  const store = getStore();
  const dashboard = store.dashboard.getModel();

  if (dashboard) {
    dashboard.destroy();
    dispatch(cancelVariables(dashboard.uid));
  }

  getTimeSrv().stopAutoRefresh();
  dispatch(cleanUpDashboard());
  dispatch(removeAllPanels());

  dashboardWatcher.leave();

  getDashboardSrv().setCurrent(undefined);
};

export const updateTimeZoneDashboard =
  (timeZone: TimeZone): ThunkResult<void> =>
  (dispatch) => {
    dispatch(updateTimeZoneForSession(timeZone));
    getTimeSrv().refreshTimeModel();
  };

export const updateWeekStartDashboard =
  (weekStart?: WeekStart): ThunkResult<void> =>
  (dispatch) => {
    dispatch(updateWeekStartForSession(weekStart));
    getTimeSrv().refreshTimeModel();
  };
