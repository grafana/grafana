import { PreferencesSpec } from '../../features/preferences/api/user/endpoints.gen';

import { backendSrv } from './backend_srv';

export class PreferencesService {
  constructor(private resourceUri: string) {}

  /**
   * Overrides all preferences
   */
  update(preferences: PreferencesSpec) {
    return backendSrv.put(`/api/${this.resourceUri}/preferences`, preferences);
  }

  /**
   * Updates only provided preferences
   */
  patch(preferences: Partial<PreferencesSpec>) {
    return backendSrv.patch(`/api/${this.resourceUri}/preferences`, preferences);
  }

  load(): Promise<PreferencesSpec> {
    return backendSrv.get<PreferencesSpec>(`/api/${this.resourceUri}/preferences`);
  }
}
