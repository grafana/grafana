export interface AppNotification {
  id: number;
  severity: string;
  icon: string;
  title: string;
  text: string;
}

export interface AppNotificationsState {
  appNotifications: AppNotification[];
}
