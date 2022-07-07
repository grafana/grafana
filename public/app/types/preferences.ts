import { TimeZone } from '@grafana/data';

export interface UserPreferencesDTO {
  timezone: TimeZone;
  weekStart: string;
  locale: string;
  homeDashboardId: number;
  theme: string;
  queryHistory: {
    homeTab: '' | 'query' | 'starred';
  };
}
