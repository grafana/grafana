import { CancelToken } from 'axios';

import { api } from 'app/percona/shared/helpers/api';

import { StorageLocationListReponse, StorageLocationReponse } from './StorageLocations.types';

const BASE_URL = '/v1/backups/locations';

export const StorageLocationsService = {
  async list(token?: CancelToken): Promise<StorageLocationListReponse> {
    return api.get(BASE_URL, false, { cancelToken: token });
  },
  async add(payload: Partial<StorageLocationReponse>, token?: CancelToken): Promise<void> {
    return api.post(BASE_URL, payload, false, token);
  },
  async update(payload: Partial<StorageLocationReponse>, token?: CancelToken): Promise<void> {
    return api.put(`${BASE_URL}/${payload.location_id}`, payload, false, token);
  },
  async testLocation(payload: Partial<StorageLocationReponse>, token?: CancelToken): Promise<boolean> {
    return api.post(`${BASE_URL}:testConfig`, payload, false, token);
  },
  async delete(locationID: string, force: boolean, token?: CancelToken): Promise<void> {
    return api.delete(`${BASE_URL}/${locationID}`, false, token, { force });
  },
};
