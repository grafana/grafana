import { TimeZone } from '@grafana/data';

export interface UserPreferencesDTO {
  timezone: TimeZone;
  homeDashboardId: number;
  navPosition: 'left' | 'right' | 'top' | 'bottom';
  theme: string;
}
