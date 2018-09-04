import { Dispatch } from 'redux';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { AlertRuleApi, StoreState } from 'app/types';

export enum ActionTypes {
  LoadAlertRules = 'LOAD_ALERT_RULES',
  SetSearchQuery = 'SET_SEARCH_QUERY',
}

export interface LoadAlertRulesAction {
  type: ActionTypes.LoadAlertRules;
  payload: AlertRuleApi[];
}

export interface SetSearchQueryAction {
  type: ActionTypes.SetSearchQuery;
  payload: string;
}

export const loadAlertRules = (rules: AlertRuleApi[]): LoadAlertRulesAction => ({
  type: ActionTypes.LoadAlertRules,
  payload: rules,
});

export const setSearchQuery = (query: string): SetSearchQueryAction => ({
  type: ActionTypes.SetSearchQuery,
  payload: query,
});

export type Action = LoadAlertRulesAction | SetSearchQueryAction;

export const getAlertRulesAsync = (options: { state: string }) => async (
  dispatch: Dispatch<Action>
): Promise<AlertRuleApi[]> => {
  try {
    const rules = await getBackendSrv().get('/api/alerts', options);
    dispatch(loadAlertRules(rules));
    return rules;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const togglePauseAlertRule = (id: number, options: { paused: boolean }) => async (
  // Maybe fix dispatch type?
  dispatch: Dispatch<any>,
  getState: () => StoreState
): Promise<boolean> => {
  try {
    await getBackendSrv().post(`/api/alerts/${id}/pause`, options);
    const stateFilter = getState().location.query.state || 'all';
    dispatch(getAlertRulesAsync({ state: stateFilter.toString() }));
    return true;
  } catch (error) {
    console.log(error);
    throw error;
  }
};
