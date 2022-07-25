import { getBackendSrv } from 'app/core/services/backend_srv';
import store from 'app/core/store';
import { API_KEYS_MIGRATION_INFO_STORAGE_KEY } from 'app/features/serviceaccounts/constants';
import { ApiKey, ThunkResult } from 'app/types';

import {
  apiKeysLoaded,
  includeExpiredToggled,
  isFetching,
  apiKeysMigrationStatusLoaded,
  setSearchQuery,
} from './reducers';

export function addApiKey(apiKey: ApiKey, openModal: (key: string) => void): ThunkResult<void> {
  return async (dispatch) => {
    const result = await getBackendSrv().post('/api/auth/keys', apiKey);
    dispatch(setSearchQuery(''));
    dispatch(loadApiKeys());
    openModal(result.key);
  };
}

export function loadApiKeys(): ThunkResult<void> {
  return async (dispatch) => {
    dispatch(isFetching());
    const [keys, keysIncludingExpired] = await Promise.all([
      getBackendSrv().get('/api/auth/keys?includeExpired=false&accesscontrol=true'),
      getBackendSrv().get('/api/auth/keys?includeExpired=true&accesscontrol=true'),
    ]);
    dispatch(apiKeysLoaded({ keys, keysIncludingExpired }));
  };
}

export function deleteApiKey(id: number): ThunkResult<void> {
  return async (dispatch) => {
    getBackendSrv()
      .delete(`/api/auth/keys/${id}`)
      .then(() => dispatch(loadApiKeys()));
  };
}

export function migrateApiKey(id: number): ThunkResult<void> {
  return async (dispatch) => {
    try {
      await getBackendSrv().post(`/api/serviceaccounts/migrate/${id}`);
    } finally {
      dispatch(loadApiKeys());
    }
  };
}

export function migrateAll(): ThunkResult<void> {
  return async (dispatch) => {
    try {
      await getBackendSrv().post('/api/serviceaccounts/migrate');
      store.set(API_KEYS_MIGRATION_INFO_STORAGE_KEY, true);
    } finally {
      dispatch(getApiKeysMigrationStatus());
      dispatch(loadApiKeys());
    }
  };
}

export function getApiKeysMigrationStatus(): ThunkResult<void> {
  return async (dispatch) => {
    const result = await getBackendSrv().get('/api/serviceaccounts/migrationstatus');
    dispatch(apiKeysMigrationStatusLoaded(!!result?.migrated));
  };
}

export function hideApiKeys(): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().post('/api/serviceaccounts/hideApiKeys');
  };
}

export function toggleIncludeExpired(): ThunkResult<void> {
  return (dispatch) => {
    dispatch(includeExpiredToggled());
  };
}
