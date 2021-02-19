import { getBackendSrv } from 'app/core/services/backend_srv';
import { ApiKey, ThunkResult } from 'app/types';
import { apiKeysLoaded, setSearchQuery } from './reducers';

export function addApiKey(
  apiKey: ApiKey,
  openModal: (key: string) => void,
  includeExpired: boolean
): ThunkResult<void> {
  return async dispatch => {
    const result = await getBackendSrv().post('/api/auth/keys', apiKey);
    dispatch(setSearchQuery(''));
    dispatch(loadApiKeys(includeExpired));
    openModal(result.key);
  };
}

export function loadApiKeys(includeExpired: boolean): ThunkResult<void> {
  return async dispatch => {
    const response = await getBackendSrv().get('/api/auth/keys?includeExpired=' + includeExpired);
    dispatch(apiKeysLoaded(response));
  };
}

export function deleteApiKey(id: number, includeExpired: boolean): ThunkResult<void> {
  return async dispatch => {
    getBackendSrv()
      .delete(`/api/auth/keys/${id}`)
      .then(() => dispatch(loadApiKeys(includeExpired)));
  };
}
