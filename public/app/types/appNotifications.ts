export interface AppNotification {
  id?: number;
  severity: AppNotificationSeverity;
  icon: string;
  title: string;
  text: string;
  timeout: AppNotificationTimeout;
}

export enum AppNotificationSeverity {
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
  Info = 'info',
}

export enum AppNotificationTimeout {
  Warning = 5000,
  Success = 3000,
  Error = 7000,
}

export interface AppNotificationsState {
  appNotifications: AppNotification[];
}
