import { lastValueFrom } from 'rxjs';

import {
  getBackendSrv,
  isFetchError,
  callDataSourcePluginProxy as stableCallDatasourcePluginProxy,
  type BackendSrvRequest,
  type FetchResponse,
} from '@grafana/runtime';

interface RequestOptions
  extends Pick<BackendSrvRequest, 'method' | 'headers' | 'data' | 'abortSignal' | 'credentials' | 'responseType'> {}

interface CallArgs {
  pluginId: string;
  uid: string;
  routePath: string;
  showErrorAlert?: boolean;
  apiVersion?: string;
  request?: RequestOptions;
}

export async function callDataSourcePluginProxy<T = unknown>(args: CallArgs): Promise<FetchResponse<T> | undefined> {
  if (typeof stableCallDatasourcePluginProxy === 'function') {
    return stableCallDatasourcePluginProxy<T>(args);
  }

  return backwardsCompatibleCallDataSourcePluginProxy<T>(args);
}

function backwardsCompatibleCallDataSourcePluginProxy<T = unknown>({
  uid,
  routePath,
  showErrorAlert = false,
  request,
}: CallArgs): Promise<FetchResponse<T>> {
  const { method = 'GET', headers, data, abortSignal, credentials, responseType } = request ?? {};

  return lastValueFrom(
    getBackendSrv().fetch<T>({
      url: `/api/datasources/proxy/uid/${uid}/${routePath}`,
      method,
      headers,
      data,
      abortSignal,
      credentials,
      responseType,
      showErrorAlert,
      validatePath: true,
    })
  ).catch((err) => {
    // User does not have access to plugin
    if (isFetchError(err) && (err.status === 401 || err.status === 403)) {
      err.isHandled = true;
    }

    return Promise.reject(err);
  });
}
