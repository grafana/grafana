import { AppEvents } from '@grafana/data';
import { BackendSrvRequest, getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import { appEvents } from 'app/core/core';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { HttpRequestMethod } from '../../panelcfg.gen';

import { APIEditorConfig } from './APIEditor';

type IsLoadingCallback = (loading: boolean) => void;

export const callApi = (api: APIEditorConfig, updateLoadingStateCallback?: IsLoadingCallback) => {
  if (api && api.endpoint) {
    // If API endpoint origin matches Grafana origin, don't call it.
    if (requestMatchesGrafanaOrigin(api.endpoint)) {
      appEvents.emit(AppEvents.alertError, ['Cannot call API at Grafana origin.']);
      updateLoadingStateCallback && updateLoadingStateCallback(false);
      return;
    }
    const request = getRequest(api);

    getBackendSrv()
      .fetch(request)
      .subscribe({
        error: (error) => {
          appEvents.emit(AppEvents.alertError, ['An error has occurred. Check console output for more details.']);
          console.error('API call error: ', error);
          updateLoadingStateCallback && updateLoadingStateCallback(false);
        },
        complete: () => {
          appEvents.emit(AppEvents.alertSuccess, ['API call was successful']);
          updateLoadingStateCallback && updateLoadingStateCallback(false);
        },
      });
  }
};

export const interpolateVariables = (text: string) => {
  const panel = getDashboardSrv().getCurrent()?.panelInEdit;
  return getTemplateSrv().replace(text, panel?.scopedVars);
};

export const getRequest = (api: APIEditorConfig) => {
  const requestHeaders: HeadersInit = [];

  const url = new URL(interpolateVariables(api.endpoint!));

  let request: BackendSrvRequest = {
    url: url.toString(),
    method: api.method,
    data: getData(api),
    headers: requestHeaders,
  };

  if (api.headerParams) {
    api.headerParams.forEach((param) => {
      requestHeaders.push([interpolateVariables(param[0]), interpolateVariables(param[1])]);
    });
  }

  if (api.queryParams) {
    api.queryParams?.forEach((param) => {
      url.searchParams.append(interpolateVariables(param[0]), interpolateVariables(param[1]));
    });

    request.url = url.toString();
  }

  if (api.method === HttpRequestMethod.POST) {
    requestHeaders.push(['Content-Type', api.contentType!]);
  }

  request.headers = requestHeaders;

  return request;
};

const getData = (api: APIEditorConfig) => {
  let data: string | undefined = api.data ? interpolateVariables(api.data) : '{}';
  if (api.method === HttpRequestMethod.GET) {
    data = undefined;
  }

  return data;
};

const requestMatchesGrafanaOrigin = (requestEndpoint: string) => {
  const requestURL = new URL(requestEndpoint);
  const grafanaURL = new URL(window.location.origin);
  return requestURL.origin === grafanaURL.origin;
};
