import { defaults } from 'lodash';
import { Observable } from 'rxjs';

import { FetchResponse, getBackendSrv, locationService, getTemplateSrv } from '@grafana/runtime';

export interface RequestOptions {
  method?: string;
  url?: string;
  headers: Record<string, string>;
  data?: any;
  requestId?: string;
}

export interface VariablesMap {
  [key: string]: string | string[] | undefined;
}

export const _request = <T>(
  url: string,
  data?: string | object | null,
  options?: RequestOptions
): Observable<FetchResponse<T>> => {
  options = defaults(options || {}, {
    url: 'http://localhost.bmc.com:3000/' + url,
    method: 'GET',
    headers: { Authorization: '' },
  });

  if (options.method === 'GET') {
    if (data && Object.keys(data).length) {
      options.url =
        options.url +
        '?' +
        Object.entries(data)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join('&');
    }
  } else {
    options.headers['Content-Type'] = 'application/json';
    options.data = data;
  }
  return getBackendSrv().fetch(options as Required<RequestOptions>);
};

export const setVariables = (filters: VariablesMap): void => {
  locationService.partial({ ...filters }, false);
};

function getVariableValue(variable: any) {
  if (variable && variable.current) {
    let curr = variable.current.value;
    if (Array.isArray(curr)) {
      return curr[0] && curr[0] !== 'null' ? curr : undefined;
    }
    return [variable.current.value];
  }
  return undefined;
}

export const getVariables = (): VariablesMap => {
  return getTemplateSrv()
    .getVariables()
    .reduce((variablesMap: VariablesMap, variable: any) => {
      return Object.assign(variablesMap, {
        [variable.id]: getVariableValue(variable),
      });
    }, {});
};
