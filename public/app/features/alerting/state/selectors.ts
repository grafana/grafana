import { AlertRule, AlertRuleState, AlertRulesState } from 'app/types';

export const getSearchQuery = (state: AlertRulesState) => state.searchQuery;

export const getAlertRuleItems = (state: AlertRulesState) => {
  const regex = new RegExp(state.searchQuery, 'i');

  return state.items.filter(item => {
    return regex.test(item.name) || regex.test(item.stateText) || regex.test(item.info!);
  });
};

export const getAlertRule = (state: AlertRuleState, currentAlertId: any): AlertRule | null => {
  if (state.alertRule.id === parseInt(currentAlertId, 10)) {
    return state.alertRule;
  }

  return null;
};
