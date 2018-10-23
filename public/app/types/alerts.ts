export interface AppNotification {
  severity: string;
  icon: string;
  title: string;
  text: string;
}

export interface AlertsState {
  alerts: AppNotification[];
}
