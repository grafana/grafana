import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppNotification, AppNotificationsState } from 'app/types/';

export const initialState: AppNotificationsState = {
  appNotifications: [] as AppNotification[],
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
    notifyApp: (state, action: PayloadAction<AppNotification>): AppNotificationsState => ({
      ...state,
      appNotifications: state.appNotifications.concat([action.payload]),
    }),
    clearAppNotification: (state, action: PayloadAction<string>): AppNotificationsState => ({
      ...state,
      appNotifications: state.appNotifications.filter(appNotification => appNotification.id !== action.payload),
    }),
  },
});

export const { notifyApp, clearAppNotification } = appNotificationsSlice.actions;

export const appNotificationsReducer = appNotificationsSlice.reducer;
