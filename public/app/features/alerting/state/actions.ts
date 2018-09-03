import { Dispatch } from 'redux';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { AlertRule } from 'app/types';

export enum ActionTypes {
  LoadAlertRules = 'LOAD_ALERT_RULES',
  SetSearchQuery = 'SET_SEARCH_QUERY',
}

export interface LoadAlertRulesAction {
  type: ActionTypes.LoadAlertRules;
  payload: AlertRule[];
}

export interface SetSearchQueryAction {
  type: ActionTypes.SetSearchQuery;
  payload: string;
}

export const loadAlertRules = (rules: AlertRule[]): LoadAlertRulesAction => ({
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
): Promise<AlertRule[]> => {
  try {
    const rules = await getBackendSrv().get('/api/alerts', options);
    dispatch(loadAlertRules(rules));
    return rules;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
