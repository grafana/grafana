import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, ThunkResult } from 'app/types';

import { settingsLoaded } from './reducers';

export function loadSettings(): ThunkResult<void> {
  return async (dispatch) => {
    if (contextSrv.hasPermission(AccessControlAction.SettingsRead)) {
      const result = await getBackendSrv().get('/api/admin/settings');
      console.log(result);
      dispatch(settingsLoaded(result));
    }
  };
}
