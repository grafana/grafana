import { AlertDefinition, AlertRule, AlertRulesState, NotificationChannelState, StoreState } from 'app/types';
import { config } from '@grafana/runtime';

export const getSearchQuery = (state: AlertRulesState) => state.searchQuery;

export const getAlertRuleItems = (state: StoreState) => {
  const regex = new RegExp(state.alertRules.searchQuery, 'i');
  const result: Array<AlertRule | AlertDefinition> = [];

  result.push(
    ...state.alertRules.items.filter((item) => {
      return regex.test(item.name) || regex.test(item.stateText) || regex.test(item.info!);
    })
  );

  if (config.featureToggles.ngalert) {
    result.push(
      ...state.alertDefinition.alertDefinitions.filter((item) => {
        return regex.test(item.title);
      })
    );
  }

  return result;
};

export const getNotificationChannel = (state: NotificationChannelState, channelId: number) => {
  if (state.notificationChannel.id === channelId) {
    return state.notificationChannel;
  }

  return null;
};
