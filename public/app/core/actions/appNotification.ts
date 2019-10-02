import { AppNotification } from 'app/types/';

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
  payload: number;
}

export type Action = AddAppNotificationAction | ClearAppNotificationAction;

export const clearAppNotification = (appNotificationId: number) => ({
  type: ActionTypes.ClearAppNotification,
  payload: appNotificationId,
});

export const notifyApp = (appNotification: AppNotification) => ({
  type: ActionTypes.AddAppNotification,
  payload: appNotification,
});
