import { getBackendSrv } from '@grafana/runtime';
import { AlertRuleDTO, ThunkResult } from 'app/types';
import { loadAlertRules, loadedAlertRules } from './reducers';

export function getAlertRulesAsync(options: { state: string }): ThunkResult<void> {
  return async dispatch => {
    dispatch(loadAlertRules());
    const rules: AlertRuleDTO[] = await getBackendSrv().get('/api/alerts', options);
    dispatch(loadedAlertRules(rules));
  };
}

export function togglePauseAlertRule(id: number, options: { paused: boolean }): ThunkResult<void> {
  return async (dispatch, getState) => {
    await getBackendSrv().post(`/api/alerts/${id}/pause`, options);
    const stateFilter = getState().location.query.state || 'all';
    dispatch(getAlertRulesAsync({ state: stateFilter.toString() }));
  };
}
