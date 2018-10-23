import { AppNotification, AlertsState } from 'app/types';
import { Action, ActionTypes } from './actions';

export const initialState: AlertsState = {
  alerts: [] as AppNotification[],
};

export const alertsReducer = (state = initialState, action: Action): AlertsState => {
  switch (action.type) {
    case ActionTypes.AddAppNotification:
      return { ...state, alerts: state.alerts.concat([action.payload]) };
    case ActionTypes.ClearAppNotification:
      return {
        ...state,
        alerts: state.alerts.filter(alert => alert !== action.payload),
      };
  }
  return state;
};

export default {
  alerts: alertsReducer,
};
