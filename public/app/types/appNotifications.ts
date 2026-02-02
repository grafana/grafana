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

export enum AppNotificationTimeout {
  Success = 3000,
  Warning = 5000,
  Error = 7000,
  // BMC code - next line
  Info = 0,
}

export const timeoutMap = {
  [AppNotificationSeverity.Success]: AppNotificationTimeout.Success,
  [AppNotificationSeverity.Warning]: AppNotificationTimeout.Warning,
  [AppNotificationSeverity.Error]: AppNotificationTimeout.Error,
  // BMC code - inline change
  [AppNotificationSeverity.Info]: AppNotificationTimeout.Info,
};

export interface AppNotificationsState {
  byId: Record<string, AppNotification>;
  lastRead: number;
}
