import { AppNotification } from 'app/types';

export enum ActionTypes {
  AddAppNotification = 'ADD_APP_NOTIFICATION',
  ClearAppNotification = 'CLEAR_APP_NOTIFICATION',
}

interface AddAppNotificationAction {
  type: ActionTypes.AddAppNotification;
  payload: AppNotification;
}

interface ClearAppNotificationAction {
  type: ActionTypes.ClearAppNotification;
  payload: AppNotification;
}

export type Action = AddAppNotificationAction | ClearAppNotificationAction;

export const clearAppNotification = (alert: AppNotification) => ({
  type: ActionTypes.ClearAppNotification,
  payload: alert,
});

export const addAppNotification = (alert: AppNotification) => ({
  type: ActionTypes.AddAppNotification,
  payload: alert,
});
