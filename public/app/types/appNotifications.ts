import { AppNotification, AppNotificationSeverity, AppNotificationType } from '@grafana/data';

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

export const tagColorMap = {
  [AppNotificationType.Access]: 0,
  [AppNotificationType.Permissions]: 1,
  [AppNotificationType.ProductAnnouncement]: 2,
  [AppNotificationType.SystemMessage]: 3,
  [AppNotificationType.Update]: 4,
};

export interface AppNotificationsState {
  byId: Record<string, AppNotification>;
  lastRead: number;
}
