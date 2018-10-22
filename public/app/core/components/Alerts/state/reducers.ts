import { Alert, AlertsState } from 'app/types';
import { Action, ActionTypes } from './actions';

export const initialState: AlertsState = {
  alerts: [] as Alert[],
};

export const alertsReducer = (state = initialState, action: Action): AlertsState => {
  switch (action.type) {
    case ActionTypes.AddAlert:
      return { ...state, alerts: state.alerts.concat([action.payload]) };
    case ActionTypes.ClearAlert:
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
