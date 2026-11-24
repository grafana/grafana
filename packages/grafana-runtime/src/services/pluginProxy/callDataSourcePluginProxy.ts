import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { getBackendSrv } from '../backendSrv';
import { getPluginMetaFromCache } from '../pluginMeta/plugins';
import { logPluginSettingsDebug, logPluginSettingsError } from '../pluginSettings/logging';
import { getApiVersion, isAuthError, assertPluginIdFormat, assertApiVersion, assertUIDFormat } from '../pluginUtils';

interface LegacyArgs {
  uid: string;
  routePath: string;
  showErrorAlert: boolean;
}

function callLegacyPluginProxy<T = unknown>({ routePath, uid, showErrorAlert }: LegacyArgs): Promise<T> {
  const options = { showErrorAlert, validatePath: true };

  return getBackendSrv()
    .get<T>(`/api/datasources/proxy/uid/${uid}/${routePath}`, undefined, undefined, options)
    .catch((err) => {
      // User does not have access to plugin
      if (isAuthError(err)) {
        err.isHandled = true;
        return Promise.reject(err);
      }

      logPluginSettingsError('PluginProxy: calling legacy datasource plugin proxy failed', err, { uid, routePath });
      return Promise.reject(err);
    });
}

interface CallArgs extends Pick<LegacyArgs, 'uid' | 'routePath'> {
  pluginId: string;
  showErrorAlert?: boolean;
  apiVersion?: string;
}

/**
 * Send a GET request to a datasource plugin's configured proxy route.
 * @param options - The proxy request options.
 * @param options.pluginId - The ID of the datasource plugin.
 * @param options.uid - The uid of the datasource plugin instance. This is used to identify the specific instance of the plugin to proxy the request to.
 * @param options.routePath - The route path relative to the plugin's proxy endpoint, without a leading slash.
 * @param options.apiVersion - Which api version to use for the request. Defaults to the current api version.
 * @param options.showErrorAlert - Whether to show a UI error alert if the request fails. Defaults to `false`.
 * @returns The response data, or `undefined` if the available metadata identifies a non-datasource plugin.
 * @throws If the plugin ID, UID, or API version is invalid.
 */
export async function callDataSourcePluginProxy<T = unknown>({
  pluginId,
  routePath,
  uid,
  apiVersion,
  showErrorAlert = false,
}: CallArgs): Promise<T | undefined> {
  assertPluginIdFormat(pluginId);
  assertUIDFormat(uid);

  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPluginSettings, false)) {
    return callLegacyPluginProxy<T>({ uid, routePath, showErrorAlert });
  }

  const meta = await getPluginMetaFromCache(pluginId);
  if (!meta) {
    logPluginSettingsDebug('PluginProxy: falling back to calling legacy datasource plugin proxy', { pluginId });
    return callLegacyPluginProxy<T>({ uid, routePath, showErrorAlert });
  }

  if (meta.spec.pluginJson.type !== 'datasource') {
    return undefined;
  }

  const resolvedApiVersion = apiVersion ?? (await getApiVersion());
  assertApiVersion(resolvedApiVersion);

  // TODO: replace with K8s /apis call once the backend supports datasource plugin proxying
  return callLegacyPluginProxy<T>({ uid, routePath, showErrorAlert });
}
