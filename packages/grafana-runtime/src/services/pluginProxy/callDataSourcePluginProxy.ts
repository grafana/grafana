import { lastValueFrom } from 'rxjs';

import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { getBackendSrv, type BackendSrvRequest, type FetchResponse } from '../backendSrv';
import { getPluginMetaFromCache } from '../pluginMeta/plugins';
import { logPluginSettingsDebug, logPluginSettingsError } from '../pluginSettings/logging';
import { getApiVersion, isAuthError, assertPluginIdFormat, assertApiVersion, assertUIDFormat } from '../pluginUtils';

interface RequestOptions
  extends Pick<BackendSrvRequest, 'method' | 'headers' | 'data' | 'abortSignal' | 'credentials' | 'responseType'> {}

interface LegacyArgs {
  uid: string;
  routePath: string;
  showErrorAlert: boolean;
  request?: RequestOptions;
}

function callLegacyPluginProxy<T = unknown>({
  routePath,
  uid,
  showErrorAlert,
  request,
}: LegacyArgs): Promise<FetchResponse<T>> {
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
    if (isAuthError(err)) {
      err.isHandled = true;
      return Promise.reject(err);
    }

    logPluginSettingsError('PluginProxy: calling legacy datasource plugin proxy failed', err, { uid, routePath });
    return Promise.reject(err);
  });
}

interface CallArgs extends Pick<LegacyArgs, 'uid' | 'routePath' | 'request'> {
  pluginId: string;
  showErrorAlert?: boolean;
  apiVersion?: string;
}

/**
 * Send a request to a datasource plugin's configured proxy route. Defaults to GET.
 * @param options - The proxy request options.
 * @param options.pluginId - The ID of the datasource plugin.
 * @param options.uid - The uid of the datasource plugin instance. This is used to identify the specific instance of the plugin to proxy the request to.
 * @param options.routePath - The route path relative to the plugin's proxy endpoint, without a leading slash.
 * @param options.apiVersion - Which api version to use for the request. Defaults to the current api version.
 * @param options.showErrorAlert - Whether to show a UI error alert if the request fails. Defaults to `false`.
 * @param options.request - Optional method, headers, body, cancellation, credentials, and response decoding options.
 * @returns The full FetchResponse, or `undefined` if the available metadata identifies a non-datasource plugin.
 * @throws If the plugin ID, UID, or API version is invalid.
 */
export async function callDataSourcePluginProxy<T = unknown>({
  pluginId,
  routePath,
  uid,
  apiVersion,
  showErrorAlert = false,
  request,
}: CallArgs): Promise<FetchResponse<T> | undefined> {
  assertPluginIdFormat(pluginId);
  assertUIDFormat(uid);

  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPluginSettings, false)) {
    return callLegacyPluginProxy<T>({ uid, routePath, showErrorAlert, request });
  }

  const meta = await getPluginMetaFromCache(pluginId);
  if (!meta) {
    logPluginSettingsDebug('PluginProxy: falling back to calling legacy datasource plugin proxy', { pluginId });
    return callLegacyPluginProxy<T>({ uid, routePath, showErrorAlert, request });
  }

  if (meta.spec.pluginJson.type !== 'datasource') {
    return undefined;
  }

  const resolvedApiVersion = apiVersion ?? (await getApiVersion());
  assertApiVersion(resolvedApiVersion);

  // TODO: replace with K8s /apis call once the backend supports datasource plugin proxying
  return callLegacyPluginProxy<T>({ uid, routePath, showErrorAlert, request });
}
