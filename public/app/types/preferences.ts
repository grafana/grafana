import { TimeZone } from '@grafana/data';

export interface UserPreferencesDTO {
  timezone: TimeZone;
  weekStart: string;
  locale: string;
  homeDashboardUID?: string;
  theme: string;
  queryHistory: {
    homeTab: '' | 'query' | 'starred';
  };
}
