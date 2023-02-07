import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, Settings, ThunkResult, UpdateSettingsQuery } from 'app/types';

import { settingsUpdated } from './reducers';

export function loadSettings(): ThunkResult<Promise<Settings>> {
  return async (dispatch) => {
    if (contextSrv.hasPermission(AccessControlAction.SettingsRead)) {
      const result = await getBackendSrv().get('/api/admin/settings');
      console.log(result);
      dispatch(settingsUpdated(result));
      return result;
    }
  };
}

export function saveSettings(data: UpdateSettingsQuery): ThunkResult<void> {
  return async (dispatch) => {
    if (contextSrv.hasPermission(AccessControlAction.SettingsRead)) {
      try {
        const result = await getBackendSrv().put('/api/admin/settings', data);
        console.log(result);
        dispatch(loadSettings());
      } catch (error) {
        console.log(error);
      }
    }
  };
}
