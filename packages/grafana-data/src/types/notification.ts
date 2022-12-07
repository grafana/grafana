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
  type?: AppNotificationType;
}

export enum AppNotificationSeverity {
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
  Info = 'info',
}

export enum AppNotificationType {
  Update = 'update',
  ProductAnnouncement = 'productAnnouncement',
  Permissions = 'permissions',
  Access = 'access',
  SystemMessage = 'systemMessage',
}
