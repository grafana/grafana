import { UserPreferencesDTO } from 'app/types';
import { backendSrv } from './backend_srv';

export class PreferencesService {
  constructor(private resourceUri: string) {}

  async update(preferences: UserPreferencesDTO) {
    await backendSrv.put(`/api/${this.resourceUri}/preferences`, preferences);
  }

  async load(): Promise<UserPreferencesDTO> {
    return (await backendSrv.get(`/api/${this.resourceUri}/preferences`)) as UserPreferencesDTO;
  }
}
