import { type AlertRule, type AlertRulesState } from 'app/features/alerting/unified/types/alerting';
import { type StoreState } from 'app/types/store';

export const getSearchQuery = (state: AlertRulesState) => state.searchQuery;

export const getAlertRuleItems = (state: StoreState): AlertRule[] => {
  const regex = new RegExp(state.alertRules.searchQuery, 'i');

  return state.alertRules.items.filter((item) => {
    return regex.test(item.name) || regex.test(item.stateText) || regex.test(item.info!);
  });
};
