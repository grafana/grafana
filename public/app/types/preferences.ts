import { TimeZone } from '@grafana/data';

export interface UserPreferencesDTO {
  timezone: TimeZone;
  weekStart: string;
  homeDashboardId: number;
  theme: string;
}
