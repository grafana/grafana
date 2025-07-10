import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { AppNotification, AppNotificationSeverity, AppNotificationsState } from 'app/types/appNotifications';

const MAX_STORED_NOTIFICATIONS = 25;
export const STORAGE_KEY = 'notifications';
export const NEW_NOTIFS_KEY = `${STORAGE_KEY}/lastRead`;
type StoredNotification = Omit<AppNotification, 'component'>;

export const initialState: AppNotificationsState = {
  byId: deserializeNotifications(),
  lastRead: Number.parseInt(window.localStorage.getItem(NEW_NOTIFS_KEY) ?? `${Date.now()}`, 10),
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
      if (Object.values(state.byId).some((alert) => isSimilar(newAlert, alert) && alert.showing)) {
        return;
      }

      state.byId[newAlert.id] = newAlert;
      serializeNotifications(state.byId);
    },
    hideAppNotification: (state, { payload: alertId }: PayloadAction<string>) => {
      if (!(alertId in state.byId)) {
        return;
      }

      state.byId[alertId].showing = false;
      serializeNotifications(state.byId);
    },
    clearNotification: (state, { payload: alertId }: PayloadAction<string>) => {
      delete state.byId[alertId];
      serializeNotifications(state.byId);
    },
    clearAllNotifications: (state) => {
      state.byId = {};
      serializeNotifications(state.byId);
    },
    readAllNotifications: (state, { payload: timestamp }: PayloadAction<number>) => {
      state.lastRead = timestamp;
    },
  },
});

export const { notifyApp, hideAppNotification, clearNotification, clearAllNotifications, readAllNotifications } =
  appNotificationsSlice.actions;

export const appNotificationsReducer = appNotificationsSlice.reducer;

// Selectors

export const selectLastReadTimestamp = (state: AppNotificationsState) => state.lastRead;
export const selectById = (state: AppNotificationsState) => state.byId;
export const selectAll = createSelector(selectById, (byId) =>
  Object.values(byId).sort((a, b) => b.timestamp - a.timestamp)
);
export const selectWarningsAndErrors = createSelector(selectAll, (all) => all.filter(isAtLeastWarning));
export const selectVisible = createSelector(selectById, (byId) => Object.values(byId).filter((n) => n.showing));

// Helper functions

function isSimilar(a: AppNotification, b: AppNotification): boolean {
  return a.icon === b.icon && a.severity === b.severity && a.text === b.text && a.title === b.title;
}

function isAtLeastWarning(notif: AppNotification) {
  return notif.severity === AppNotificationSeverity.Warning || notif.severity === AppNotificationSeverity.Error;
}

function isStoredNotification(obj: unknown): obj is StoredNotification {
  return typeof obj === 'object' && obj !== null && 'id' in obj && 'icon' in obj && 'title' in obj && 'text' in obj;
}

// (De)serialization

export function deserializeNotifications(): Record<string, StoredNotification> {
  const storedNotifsRaw = window.localStorage.getItem(STORAGE_KEY);
  if (!storedNotifsRaw) {
    return {};
  }

  const parsed = JSON.parse(storedNotifsRaw);
  if (!Object.values(parsed).every((v) => isStoredNotification(v))) {
    return {};
  }

  return parsed;
}

function serializeNotifications(notifs: Record<string, StoredNotification>) {
  const reducedNotifs = Object.values(notifs)
    .filter(isAtLeastWarning)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_STORED_NOTIFICATIONS)
    .reduce<Record<string, StoredNotification>>((prev, cur) => {
      prev[cur.id] = {
        id: cur.id,
        severity: cur.severity,
        icon: cur.icon,
        title: cur.title,
        text: cur.text,
        traceId: cur.traceId,
        timestamp: cur.timestamp,
        // we don't care about still showing toasts after refreshing
        // https://github.com/grafana/grafana/issues/71932
        showing: false,
      };

      return prev;
    }, {});

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reducedNotifs));
  } catch (err) {
    console.error('Unable to persist notifications to local storage');
    console.error(err);
  }
}
