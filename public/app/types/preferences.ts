import { TimeZone } from '@grafana/data';

export interface UserPreferencesDTO {
  timezone: TimeZone;
  weekStart: string;
  locale: string;
  // Deprecated in favor of homeDashboardUID
  homeDashboardId?: number;
  homeDashboardUID?: string;
  theme: string;
  queryHistory: {
    homeTab: '' | 'query' | 'starred';
  };
}
