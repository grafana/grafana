import { lastValueFrom } from 'rxjs';

import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import {
  AccessControlAction,
  Settings,
  ThunkResult,
  SettingsError,
  UpdateSettingsQuery,
  AuthProviderStatus,
} from 'app/types';

import { getAuthProviderStatus, getRegisteredAuthProviders } from '..';

import { providerStatusesLoaded, resetError, setError, settingsUpdated } from './reducers';

export function loadSettings(): ThunkResult<Promise<Settings>> {
  return async (dispatch) => {
    if (contextSrv.hasPermission(AccessControlAction.SettingsRead)) {
      const result = await getBackendSrv().get('/api/admin/settings');
      dispatch(settingsUpdated(result));
      dispatch(loadProviderStatuses());
      return result;
    }
  };
}

export function loadProviderStatuses(): ThunkResult<void> {
  return async (dispatch) => {
    const registeredProviders = getRegisteredAuthProviders();
    const providerStatuses: { [key: string]: AuthProviderStatus } = {};
    for (const provider of registeredProviders) {
      const status = await getAuthProviderStatus(provider.id);
      providerStatuses[provider.id] = status;
    }
    dispatch(providerStatusesLoaded(providerStatuses));
  };
}

export function saveSettings(data: UpdateSettingsQuery): ThunkResult<Promise<boolean>> {
  return async (dispatch) => {
    if (contextSrv.hasPermission(AccessControlAction.SettingsRead)) {
      try {
        await lastValueFrom(
          getBackendSrv().fetch({
            url: '/api/admin/settings',
            method: 'PUT',
            data,
            showSuccessAlert: false,
            showErrorAlert: false,
          })
        );
        dispatch(resetError());
        return true;
      } catch (error) {
        console.log(error);
        if (isFetchError(error)) {
          error.isHandled = true;
          const updateErr: SettingsError = {
            message: error.data?.message,
            errors: error.data?.errors,
          };
          dispatch(setError(updateErr));
          return false;
        }
      }
    }
    return false;
  };
}
