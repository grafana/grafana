import { AppEvents } from '@grafana/data';
import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';
import { appEvents } from 'app/core/core';

import { APIEditorConfig } from './APIEditor';

export const callApi = (api: APIEditorConfig, isTest = false, request?: BackendSrvRequest) => {
  if (api && api.endpoint) {
    if (!request) {
      request = {
        url: api.endpoint!,
        method: 'POST',
        data: api.data ?? {},
      };
    }

    getBackendSrv()
      .fetch(request)
      .subscribe({
        error: (error) => {
          if (isTest) {
            appEvents.emit(AppEvents.alertError, ['Error has occurred: ', JSON.stringify(error)]);
            console.error(error);
          }
        },
        complete: () => {
          if (isTest) {
            appEvents.emit(AppEvents.alertSuccess, ['Test successful']);
          }
        },
      });
  }
};
