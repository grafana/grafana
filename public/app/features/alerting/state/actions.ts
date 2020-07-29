import { AppEvents } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { AlertRuleDTO, NotifierDTO, ThunkResult } from 'app/types';
import { appEvents } from 'app/core/core';
import { updateLocation } from 'app/core/actions';
import { loadAlertRules, loadedAlertRules, setNotificationChannels } from './reducers';

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

export function createNotificationChannel(data: any): ThunkResult<void> {
  return async dispatch => {
    try {
      await getBackendSrv().post(`/api/alert-notifications`, data);
      appEvents.emit(AppEvents.alertSuccess, ['Notification created']);
      dispatch(updateLocation({ path: 'alerting/notifications' }));
    } catch (error) {
      appEvents.emit(AppEvents.alertError, [error.data.error]);
    }
  };
}

export function testNotificationChannel(data: any): ThunkResult<void> {
  return async () => {
    await getBackendSrv().post('/api/alert-notifications/test', data);
  };
}

export function loadNotificationTypes(): ThunkResult<void> {
  return async dispatch => {
    const alertNotifiers: NotifierDTO[] = await getBackendSrv().get(`/api/alert-notifiers`);

    const notificationTypes = alertNotifiers
      .map((option: NotifierDTO) => {
        return {
          value: option.type,
          label: option.name,
          ...option,
          typeName: option.type,
        };
      })
      .sort((o1, o2) => {
        if (o1.name > o2.name) {
          return 1;
        }
        return -1;
      });

    dispatch(setNotificationChannels(notificationTypes));
  };
}
