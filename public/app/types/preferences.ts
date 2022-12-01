// import { TimeZone } from '@grafana/data';
import { Preferences } from '@grafana/schema/src/raw/preferences/x/preferences_types.gen';

export type UserPreferencesDTO = Preferences;

// export interface UserPreferencesDTO {
//   timezone: TimeZone;
//   weekStart: string;
//   language: string;
//   // It is undefined when there is not dashboard assigned (default)
//   homeDashboardUID?: string;
//   theme: string;
//   queryHistory: {
//     homeTab: '' | 'query' | 'starred';
//   };
// }
