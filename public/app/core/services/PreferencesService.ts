// BMC Code: Commented next line
// import { Preferences as UserPreferencesDTO } from '@grafana/schema/src/raw/preferences/x/preferences_types.gen';
import { BMCUserPreferencesDTO as UserPreferencesDTO } from '../components/SharedPreferences/SharedPreferences';

import { backendSrv } from './backend_srv';

export class PreferencesService {
  constructor(private resourceUri: string) {}

  /**
   * Overrides all preferences
   */
  // BMC Code : Accessibility Change (Next 1 line)
  update(preferences: Partial<UserPreferencesDTO>) {
    return backendSrv.put(`/api/${this.resourceUri}/preferences`, preferences);
  }

  /**
   * Updates only provided preferences
   */
  patch(preferences: Partial<UserPreferencesDTO>) {
    return backendSrv.patch(`/api/${this.resourceUri}/preferences`, preferences);
  }

  load(): Promise<UserPreferencesDTO> {
    return backendSrv.get<UserPreferencesDTO>(`/api/${this.resourceUri}/preferences`);
  }
}
