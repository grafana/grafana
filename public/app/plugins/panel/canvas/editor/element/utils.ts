import { AppEvents, textUtil } from '@grafana/data';
import { BackendSrvRequest, getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import { appEvents } from 'app/core/core';
import { createAbsoluteUrl, RelativeUrl } from 'app/features/alerting/unified/utils/url';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { HttpRequestMethod } from '../../panelcfg.gen';

import { APIEditorConfig } from './APIEditor';

type IsLoadingCallback = (loading: boolean) => void;

export const callApi = (api: APIEditorConfig, updateLoadingStateCallback?: IsLoadingCallback) => {
  if (!api.endpoint) {
    appEvents.emit(AppEvents.alertError, ['API endpoint is not defined.']);
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
  const endpoint = getEndpoint(interpolateVariables(api.endpoint));
  const url = new URL(endpoint);

  const requestHeaders: Record<string, string> = {};

  let request: BackendSrvRequest = {
    url: url.toString(),
    method: api.method,
    data: getData(api),
    headers: requestHeaders,
  };

  if (api.headerParams) {
    api.headerParams.forEach(([name, value]) => {
      requestHeaders[interpolateVariables(name)] = interpolateVariables(value);
    });
  }

  if (api.queryParams) {
    api.queryParams?.forEach(([name, value]) => {
      url.searchParams.append(interpolateVariables(name), interpolateVariables(value));
    });

    request.url = url.toString();
  }

  if (api.method === HttpRequestMethod.POST) {
    requestHeaders['Content-Type'] = api.contentType!;
  }

  requestHeaders['X-Grafana-Action'] = '1';
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
