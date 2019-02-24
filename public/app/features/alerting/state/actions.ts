import { getBackendSrv } from 'app/core/services/backend_srv';
import { AlertRuleDTO, StoreState } from 'app/types';
import { ThunkAction } from 'redux-thunk';

export enum ActionTypes {
  LoadAlertRules = 'LOAD_ALERT_RULES',
  LoadedAlertRules = 'LOADED_ALERT_RULES',
  SetSearchQuery = 'SET_ALERT_SEARCH_QUERY',
}

export interface LoadAlertRulesAction {
  type: ActionTypes.LoadAlertRules;
}

export interface LoadedAlertRulesAction {
  type: ActionTypes.LoadedAlertRules;
  payload: AlertRuleDTO[];
}

export interface SetSearchQueryAction {
  type: ActionTypes.SetSearchQuery;
  payload: string;
}

export const loadAlertRules = (): LoadAlertRulesAction => ({
  type: ActionTypes.LoadAlertRules,
});

export const loadedAlertRules = (rules: AlertRuleDTO[]): LoadedAlertRulesAction => ({
  type: ActionTypes.LoadedAlertRules,
  payload: rules,
});

export const setSearchQuery = (query: string): SetSearchQueryAction => ({
  type: ActionTypes.SetSearchQuery,
  payload: query,
});

export type Action = LoadAlertRulesAction | LoadedAlertRulesAction | SetSearchQueryAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action>;

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
