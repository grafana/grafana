import { TimeZone } from '@grafana/data';

export interface UserPreferencesDTO {
  timezone: TimeZone;
  weekStart: string;
  locale: string;
  // It is undefined when there is not dashboard assigned (default)
  homeDashboardUID?: string;
  theme: string;
  queryHistory: {
    homeTab: '' | 'query' | 'starred';
  };
}
