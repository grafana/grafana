import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppNotification, AppNotificationsState } from 'app/types/';

export const initialState: AppNotificationsState = {
  byId: {},
};

/**
 * Reducer and action to show toast notifications of various types (success, warnings, errors etc). Use to show
 * transient info to user, like errors that cannot be otherwise handled or success after an action.
 *
 * Use factory functions in core/copy/appNotifications to create the payload.
 */
const appNotificationsSlice = createSlice({
  name: 'appNotifications',
  initialState,
  reducers: {
    notifyApp: (state, { payload: newAlert }: PayloadAction<AppNotification>) => {
      if (Object.values(state.byId).some((alert) => isSimilar(newAlert, alert))) {
        return;
      }

      state.byId[newAlert.id] = newAlert;
    },
    clearAppNotification: (state, { payload: alertId }: PayloadAction<string>) => {
      delete state.byId[alertId];
    },
  },
});

export const { notifyApp, clearAppNotification } = appNotificationsSlice.actions;

export const appNotificationsReducer = appNotificationsSlice.reducer;

export const selectAll = (state: AppNotificationsState) => Object.values(state.byId);

function isSimilar(a: AppNotification, b: AppNotification): boolean {
  return (
    a.icon === b.icon &&
    a.severity === b.severity &&
    a.text === b.text &&
    a.title === b.title &&
    a.component === b.component
  );
}
