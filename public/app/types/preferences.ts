import { TimeZone } from '@grafana/data';

export interface UserPreferencesDTO {
  timezone: TimeZone;
  weekStart: string;
  language: string;
  // It is undefined when there is not dashboard assigned (default)
  homeDashboardUID?: string;
  theme: string;
  queryHistory: {
    homeTab: '' | 'query' | 'starred';
  };
}
