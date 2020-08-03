import { AlertRule, AlertRuleState, AlertRulesState } from 'app/types';

export const getSearchQuery = (state: AlertRulesState) => state.searchQuery;

export const getAlertRuleItems = (state: AlertRulesState) => {
  const regex = new RegExp(state.searchQuery, 'i');

  return state.items.filter(item => {
    return regex.test(item.name) || regex.test(item.stateText) || regex.test(item.info!);
  });
};

export const getAlert = (state: AlertRuleState, currentAlertId: any): AlertRule | null => {
  if (state.alert.id === parseInt(currentAlertId, 10)) {
    return state.alert;
  }

  return null;
};
