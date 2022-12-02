import { AppNotification, AppNotificationSeverity } from '@grafana/data';

export enum AppNotificationTimeout {
  Success = 3000,
  Warning = 5000,
  Error = 7000,
}

export const timeoutMap = {
  [AppNotificationSeverity.Success]: AppNotificationTimeout.Success,
  [AppNotificationSeverity.Warning]: AppNotificationTimeout.Warning,
  [AppNotificationSeverity.Error]: AppNotificationTimeout.Error,
  [AppNotificationSeverity.Info]: AppNotificationTimeout.Success,
};

export interface AppNotificationsState {
  byId: Record<string, AppNotification>;
  lastRead: number;
}
