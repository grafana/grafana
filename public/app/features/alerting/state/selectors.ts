import { AlertRulesState, NotificationChannelState } from 'app/types';

export const getSearchQuery = (state: AlertRulesState) => state.searchQuery;

export const getAlertRuleItems = (state: AlertRulesState) => {
  const regex = new RegExp(state.searchQuery, 'i');

  return state.items.filter(item => {
    return regex.test(item.name) || regex.test(item.stateText) || regex.test(item.info!);
  });
};

export const getNotificationChannel = (state: NotificationChannelState, channelId: number) => {
  if (state.notificationChannel.id === channelId) {
    return state.notificationChannel;
  }

  return null;
};
