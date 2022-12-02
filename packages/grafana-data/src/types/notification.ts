export interface AppNotification {
  id: string;
  severity: AppNotificationSeverity;
  icon: string;
  title: string;
  text: string;
  traceId?: string;
  component?: React.ReactElement;
  showing: boolean;
  timestamp: number;
}

export enum AppNotificationSeverity {
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
  Info = 'info',
}
