import { Preferences as BaseUserPreferencesDTO } from '@grafana/schema/src/raw/preferences/x/preferences_types.gen';

// Extended preferences type with dateStyle
export interface UserPreferencesDTO extends BaseUserPreferencesDTO {
  dateStyle?: string; // [FIXME] the type should be generated correctly...
}

import { backendSrv } from './backend_srv';

export class PreferencesService {
  constructor(private resourceUri: string) {}

  /**
   * Overrides all preferences
   */
  update(preferences: UserPreferencesDTO) {
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
