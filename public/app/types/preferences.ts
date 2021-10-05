import { TimeZone } from '@grafana/data';

export interface UserPreferencesDTO {
  timezone: TimeZone;
  weekStart: number;
  homeDashboardId: number;
  theme: string;
}
