import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AppNotification, AppNotificationsState } from 'app/types/';

export const initialState: AppNotificationsState = {
  appNotifications: [] as AppNotification[],
};

const appNotificationsSlice = createSlice({
  name: 'appNotifications',
  initialState,
  reducers: {
    notifyApp: (state, action: PayloadAction<AppNotification>): AppNotificationsState => ({
      ...state,
      appNotifications: state.appNotifications.concat([action.payload]),
    }),
    clearAppNotification: (state, action: PayloadAction<number>): AppNotificationsState => ({
      ...state,
      appNotifications: state.appNotifications.filter(appNotification => appNotification.id !== action.payload),
    }),
  },
});

export const { notifyApp, clearAppNotification } = appNotificationsSlice.actions;

export const appNotificationsReducer = appNotificationsSlice.reducer;
