import { AlertVariant } from '@grafana/ui';
export interface AppNotification {
  id: number;
  severity: AlertVariant;
  icon: string;
  title: string;
  text: string;
  timeout: AppNotificationTimeout;
}

export enum AppNotificationTimeout {
  Warning = 5000,
  Success = 3000,
  Error = 7000,
}

export interface AppNotificationsState {
  appNotifications: AppNotification[];
}
