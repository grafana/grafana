import { NavLinkDTO, TimeZone } from '@grafana/data';

export interface UserPreferencesDTO {
  timezone: TimeZone;
  weekStart: string;
  homeDashboardId: number;
  theme: string;
  navbar: {
    savedItems: NavLinkDTO[];
  };
}
