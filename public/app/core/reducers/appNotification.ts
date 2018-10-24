import { AppNotification, AppNotificationsState } from 'app/types/';
import { Action, ActionTypes } from '../actions/appNotification';

export const initialState: AppNotificationsState = {
  appNotifications: [] as AppNotification[],
};

export const appNotificationsReducer = (state = initialState, action: Action): AppNotificationsState => {
  switch (action.type) {
    case ActionTypes.AddAppNotification:
      return { ...state, appNotifications: state.appNotifications.concat([action.payload]) };
    case ActionTypes.ClearAppNotification:
      return {
        ...state,
        appNotifications: state.appNotifications.filter(appNotification => appNotification.id !== action.payload),
      };
  }
  return state;
};
