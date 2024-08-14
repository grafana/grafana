import { AppEvents, textUtil } from '@grafana/data';
import { BackendSrvRequest, getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import config from 'app/core/config';
import { appEvents } from 'app/core/core';
import { createAbsoluteUrl, RelativeUrl } from 'app/features/alerting/unified/utils/url';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { HttpRequestMethod } from '../../panelcfg.gen';

import { APIEditorConfig } from './APIEditor';

type IsLoadingCallback = (loading: boolean) => void;

const allowedAPIEndpointPattern = 'api/plugins';

export const callApi = (api: APIEditorConfig, updateLoadingStateCallback?: IsLoadingCallback) => {
  if (!api.endpoint) {
    appEvents.emit(AppEvents.alertError, ['API endpoint is not defined.']);
    return;
  }

  const endpoint = interpolateVariables(getEndpoint(api.endpoint));

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  if (!isRequestUrlAllowed(api.method as HttpRequestMethod, endpoint)) {
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
};

export const interpolateVariables = (text: string) => {
  const panel = getDashboardSrv().getCurrent()?.panelInEdit;
  return getTemplateSrv().replace(text, panel?.scopedVars);
};

export const getRequest = (api: APIEditorConfig) => {
  const requestHeaders: HeadersInit = [];
  const endpoint = interpolateVariables(getEndpoint(api.endpoint));
  const url = new URL(endpoint);

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

const getEndpoint = (endpoint: string) => {
  const isRelativeUrl = endpoint.startsWith('/');
  if (isRelativeUrl) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const sanitizedRelativeURL = textUtil.sanitizeUrl(endpoint) as RelativeUrl;
    endpoint = createAbsoluteUrl(sanitizedRelativeURL, []);
  }

  return endpoint;
};

const isRequestUrlAllowed = (method: HttpRequestMethod, requestEndpoint: string) => {
  const allowedMethods = [HttpRequestMethod.POST, HttpRequestMethod.PUT];
  const allowedAPIRegex = new RegExp(allowedAPIEndpointPattern);

  if (allowedMethods.includes(method) && config.actions.allowPostURL !== '') {
    const allowedRegexFromConfig = new RegExp(config.actions.allowPostURL!);
    return allowedRegexFromConfig.test(requestEndpoint) && allowedAPIRegex.test(requestEndpoint);
  }

  if (method === HttpRequestMethod.GET) {
    return true;
  }

  const requestURL = new URL(requestEndpoint);
  const grafanaURL = new URL(window.location.origin);

  return requestURL.origin === grafanaURL.origin;
};
