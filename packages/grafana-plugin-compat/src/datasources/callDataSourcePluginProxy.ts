import {
  getBackendSrv,
  isFetchError,
  callDataSourcePluginProxy as stableCallDatasourcePluginProxy,
} from '@grafana/runtime';

interface CallArgs {
  pluginId: string;
  uid: string;
  routePath: string;
  showErrorAlert?: boolean;
  apiVersion?: string;
}

export async function callDataSourcePluginProxy<T = unknown>(args: CallArgs): Promise<T | undefined> {
  if (typeof stableCallDatasourcePluginProxy === 'function') {
    return stableCallDatasourcePluginProxy<T>(args);
  }

  return backwardsCompatibleCallDataSourcePluginProxy<T>(args.uid, args.routePath, args.showErrorAlert);
}

function backwardsCompatibleCallDataSourcePluginProxy<T = unknown>(
  uid: string,
  routePath: string,
  showErrorAlert = false
): Promise<T> {
  const options = { showErrorAlert, validatePath: true };

  return getBackendSrv()
    .get<T>(`/api/datasources/proxy/uid/${uid}/${routePath}`, undefined, undefined, options)
    .catch((err) => {
      // User does not have access to plugin
      if (isFetchError(err) && (err.status === 401 || err.status === 403)) {
        err.isHandled = true;
        return Promise.reject(err);
      }

      return Promise.reject(err);
    });
}
