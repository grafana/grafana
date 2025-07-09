import { AlertRule, AlertRulesState, NotificationChannelState } from 'app/types/alerting';
import { StoreState } from 'app/types/store';

export const getSearchQuery = (state: AlertRulesState) => state.searchQuery;

export const getAlertRuleItems = (state: StoreState): AlertRule[] => {
  const regex = new RegExp(state.alertRules.searchQuery, 'i');

  return state.alertRules.items.filter((item) => {
    return regex.test(item.name) || regex.test(item.stateText) || regex.test(item.info!);
  });
};

export const getNotificationChannel = (state: NotificationChannelState, channelId: number) => {
  if (state.notificationChannel.id === channelId) {
    return state.notificationChannel;
  }

  return null;
};
