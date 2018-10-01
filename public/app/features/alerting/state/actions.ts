import { getBackendSrv } from 'app/core/services/backend_srv';
import { AlertRuleDTO, StoreState } from 'app/types';
import { ThunkAction } from 'redux-thunk';

export enum ActionTypes {
  LoadAlertRules = 'LOAD_ALERT_RULES',
  SetSearchQuery = 'SET_ALERT_SEARCH_QUERY',
}

export interface LoadAlertRulesAction {
  type: ActionTypes.LoadAlertRules;
  payload: AlertRuleDTO[];
}

export interface SetSearchQueryAction {
  type: ActionTypes.SetSearchQuery;
  payload: string;
}

export const loadAlertRules = (rules: AlertRuleDTO[]): LoadAlertRulesAction => ({
  type: ActionTypes.LoadAlertRules,
  payload: rules,
});

export const setSearchQuery = (query: string): SetSearchQueryAction => ({
  type: ActionTypes.SetSearchQuery,
  payload: query,
});

export type Action = LoadAlertRulesAction | SetSearchQueryAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action>;

export function getAlertRulesAsync(options: { state: string }): ThunkResult<void> {
  return async dispatch => {
    const rules = await getBackendSrv().get('/api/alerts', options);
    dispatch(loadAlertRules(rules));
  };
}

export function togglePauseAlertRule(id: number, options: { paused: boolean }): ThunkResult<void> {
  return async (dispatch, getState) => {
    await getBackendSrv().post(`/api/alerts/${id}/pause`, options);
    const stateFilter = getState().location.query.state || 'all';
    dispatch(getAlertRulesAsync({ state: stateFilter.toString() }));
  };
}
