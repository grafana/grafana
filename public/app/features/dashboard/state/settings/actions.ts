import { ThunkResult } from '../../../../types';
import { setVariableSettings } from './reducer';
import { DashboardVariablesSettings } from './types';
import { DashboardModel } from '../DashboardModel';
import { reportInteraction } from '../../../../../../packages/grafana-runtime';

export function initDashboardSettings(dashboard: DashboardModel): ThunkResult<void> {
  return function (dispatch) {
    const variableSettings: DashboardVariablesSettings | undefined = dashboard.getVariableSettings();
    if (variableSettings) {
      dispatch(setVariableSettings(variableSettings));
      reportInteraction('Dashboard variable settings loaded', { showUnknowns: Number(variableSettings.showUnknowns) });
    }
  };
}

export function updateShowUnknownVariables(showUnknowns: boolean): ThunkResult<void> {
  return function (dispatch, getState) {
    const state = getState();
    const dashboard = state.dashboard.getModel();
    const variablesSettings: DashboardVariablesSettings = state.dashboardSettings.variables;
    if (!dashboard) {
      return;
    }

    const newSettings: DashboardVariablesSettings = { ...variablesSettings, showUnknowns };
    dashboard.updateVariableSettings(newSettings);
    dispatch(setVariableSettings(newSettings));
    reportInteraction('Dashboard variable settings updated', { showUnknowns: Number(showUnknowns) });
  };
}
