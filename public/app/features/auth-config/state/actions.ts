import { lastValueFrom } from 'rxjs';

import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, Settings, ThunkResult, SettingsUpdateError, UpdateSettingsQuery } from 'app/types';

import { resetError, setError, settingsUpdated } from './reducers';

export function loadSettings(): ThunkResult<Promise<Settings>> {
  return async (dispatch) => {
    if (contextSrv.hasPermission(AccessControlAction.SettingsRead)) {
      const result = await getBackendSrv().get('/api/admin/settings');
      dispatch(settingsUpdated(result));
      return result;
    }
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
          const updateErr: SettingsUpdateError = {
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
