import { Alert } from 'app/types';

export enum ActionTypes {
  AddAlert = 'ADD_ALERT',
  ClearAlert = 'CLEAR_ALERT',
}

interface AddAlertAction {
  type: ActionTypes.AddAlert;
  payload: Alert;
}

interface ClearAlertAction {
  type: ActionTypes.ClearAlert;
  payload: Alert;
}

export type Action = AddAlertAction | ClearAlertAction;

export const clearAlert = (alert: Alert) => ({
  type: ActionTypes.ClearAlert,
  payload: alert,
});
