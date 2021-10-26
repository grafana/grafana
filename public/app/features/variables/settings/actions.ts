import { reportInteraction } from '@grafana/runtime';

import { ThunkResult } from '../../../types';
import { setStrictPanelRefresh } from './reducer';

export function initStrictPanelRefresh(value?: boolean): ThunkResult<void> {
  return function (dispatch, getState) {
    reportStrictPanelRefreshUsage({ eventName: 'on_load', value: Boolean(value) });
    dispatch(setStrictPanelRefresh(Boolean(value)));
  };
}

export function updateStrictPanelRefresh(value: boolean): ThunkResult<void> {
  return function (dispatch, getState) {
    const dashboardModel = getState().dashboard.getModel();
    if (!dashboardModel) {
      return;
    }

    reportStrictPanelRefreshUsage({ eventName: 'on_change', value });
    dashboardModel.updateStrictRefreshPanel(value);
    dispatch(setStrictPanelRefresh(value));
  };
}

function reportStrictPanelRefreshUsage({ eventName, value }: { eventName: string; value: boolean }) {
  reportInteraction(`strict_panel_refresh_${eventName}`, { strictPanelRefresh: Number(value) });
}
