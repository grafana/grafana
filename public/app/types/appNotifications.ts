export interface AppNotification {
  id?: number;
  severity: AppNotificationSeverity;
  icon: string;
  title: string;
  text: string;
}

export enum AppNotificationSeverity {
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
  Info = 'info',
}

export interface AppNotificationsState {
  appNotifications: AppNotification[];
}
