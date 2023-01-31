import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, Settings, ThunkResult } from 'app/types';

import { settingsLoaded, samlStateUpdated } from './reducers';

export function loadSettings(): ThunkResult<void> {
  return async (dispatch) => {
    if (contextSrv.hasPermission(AccessControlAction.SettingsRead)) {
      const result = await getBackendSrv().get('/api/admin/settings');
      console.log(result);
      dispatch(settingsLoaded(result));
      dispatch(samlStateUpdated());
    }
  };
}

export function saveSettings(data: { [key: string]: Settings }): ThunkResult<void> {
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
