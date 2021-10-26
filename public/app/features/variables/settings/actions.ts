import { ThunkResult } from '../../../types';
import { setStrictPanelRefresh } from './reducer';

export function updateStrictPanelRefresh(value: boolean): ThunkResult<void> {
  return function (dispatch, getState) {
    const dashboardModel = getState().dashboard.getModel();
    if (!dashboardModel) {
      return;
    }

    dashboardModel.updateStrictRefreshPanel(value);
    dispatch(setStrictPanelRefresh(value));
  };
}
