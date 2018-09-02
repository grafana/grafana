import { Dispatch } from 'redux';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { AlertRule } from 'app/types';

export interface LoadAlertRulesAction {
  type: 'LOAD_ALERT_RULES';
  payload: AlertRule[];
}

export const loadAlertRules = (rules: AlertRule[]): LoadAlertRulesAction => ({
  type: 'LOAD_ALERT_RULES',
  payload: rules,
});

export type Action = LoadAlertRulesAction;

export const getAlertRulesAsync = () => async (dispatch: Dispatch<Action>): Promise<AlertRule[]> => {
  try {
    const rules = await getBackendSrv().get('/api/alerts', {});
    dispatch(loadAlertRules(rules));
    return rules;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
