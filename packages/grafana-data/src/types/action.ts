import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';

import { SelectableValue } from './select';

export interface Action {
  title: string;
  method: string;
  endpoint: string;
  data?: string;
  contentType?: string;
  queryParams?: Array<[string, string]>;
  headerParams?: Array<[string, string]>;
  sortIndex?: number;
}

export enum HttpRequestMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
}

export const httpMethodOptions = [
  { label: HttpRequestMethod.GET, value: HttpRequestMethod.GET },
  { label: HttpRequestMethod.POST, value: HttpRequestMethod.POST },
  { label: HttpRequestMethod.PUT, value: HttpRequestMethod.PUT },
];

export const contentTypeOptions: SelectableValue[] = [
  { label: 'JSON', value: 'application/json' },
  { label: 'Text', value: 'text/plain' },
  { label: 'JavaScript', value: 'application/javascript' },
  { label: 'HTML', value: 'text/html' },
  { label: 'XML', value: 'application/XML' },
  { label: 'x-www-form-urlencoded', value: 'application/x-www-form-urlencoded' },
];

export const defaultActionConfig: Action = {
  title: '',
  endpoint: '',
  method: HttpRequestMethod.POST,
  data: '{}',
  contentType: 'application/json',
  queryParams: [],
  headerParams: [],
};

type IsLoadingCallback = (loading: boolean) => void;

const requestMatchesGrafanaOrigin = (requestEndpoint: string) => {
  const requestURL = new URL(requestEndpoint);
  const grafanaURL = new URL(window.location.origin);
  return requestURL.origin === grafanaURL.origin;
};

// @TODO: Implement this function somewhere else
export const callApi = (apiAction: Action, updateLoadingStateCallback?: IsLoadingCallback) => {
  let returnMessage = '';

  if (apiAction && apiAction.endpoint) {
    // If API endpoint origin matches Grafana origin, don't call it.
    if (requestMatchesGrafanaOrigin(apiAction.endpoint)) {
      updateLoadingStateCallback && updateLoadingStateCallback(false);
      returnMessage = 'Cannot call API at Grafana origin.';
      return;
    }
    const request = getRequest(apiAction);

    getBackendSrv()
      .fetch(request)
      .subscribe({
        error: (error) => {
          returnMessage = 'An error has occurred. Check console output for more details.';
          updateLoadingStateCallback && updateLoadingStateCallback(false);
        },
        complete: () => {
          returnMessage = 'API call was successful';
          updateLoadingStateCallback && updateLoadingStateCallback(false);
        },
      });
  }

  return returnMessage;
};

const getRequest = (apiAction: Action) => {
  const requestHeaders: HeadersInit = [];

  const url = new URL(apiAction.endpoint!);

  let request: BackendSrvRequest = {
    url: url.toString(),
    method: apiAction.method,
    data: getData(apiAction),
    headers: requestHeaders,
  };

  if (apiAction.headerParams) {
    apiAction.headerParams.forEach((param) => {
      requestHeaders.push([param[0], param[1]]);
    });
  }

  if (apiAction.queryParams) {
    apiAction.queryParams?.forEach((param) => {
      url.searchParams.append(param[0], param[1]);
    });

    request.url = url.toString();
  }

  if (apiAction.method === HttpRequestMethod.POST) {
    requestHeaders.push(['Content-Type', apiAction.contentType!]);
  }

  request.headers = requestHeaders;

  return request;
};

const getData = (apiAction: Action) => {
  let data: string | undefined = apiAction.data ? apiAction.data : '{}';
  if (apiAction.method === HttpRequestMethod.GET) {
    data = undefined;
  }

  return data;
};
