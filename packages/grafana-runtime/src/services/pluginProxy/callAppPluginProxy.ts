import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { getBackendSrv } from '../backendSrv';
import { getAppPluginMetas } from '../pluginMeta/apps';
import { getDatasourcePluginMetas } from '../pluginMeta/datasources';
import { getPanelPluginMetas } from '../pluginMeta/panels';
import { getPluginMetaFromCache } from '../pluginMeta/plugins';
import { logPluginSettingsDebug, logPluginSettingsError } from '../pluginSettings/logging';
import { getApiVersion, getNamespace, isAuthError, isValidApiVersion, isValidPluginId } from '../pluginUtils';

interface LegacyArgs {
  pluginId: string;
  routePath: string;
  showErrorAlert: boolean;
}

function callLegacyPluginProxy<T = unknown>({ pluginId, routePath, showErrorAlert }: LegacyArgs): Promise<T> {
  const options = { showErrorAlert, validatePath: true };

  return getBackendSrv()
    .get<T>(`/api/plugin-proxy/${pluginId}/${routePath}`, undefined, undefined, options)
    .catch((err) => {
      // User does not have access to plugin
      if (isAuthError(err)) {
        err.isHandled = true;
        return Promise.reject(err);
      }

      logPluginSettingsError('PluginProxy: calling legacy plugin proxy failed', err, { pluginId });
      return Promise.reject(err);
    });
}

interface BaseArgs extends LegacyArgs {
  apiVersion: string;
}

function callPluginProxy<T = unknown>({ pluginId, routePath, apiVersion, showErrorAlert }: BaseArgs): Promise<T> {
  const options = { showErrorAlert, validatePath: true };

  return getBackendSrv()
    .get<T>(
      `/apis/${pluginId}/${apiVersion}/namespaces/${getNamespace()}/app/instance/proxy/${routePath}`,
      undefined,
      undefined,
      options
    )
    .catch((err) => {
      // User does not have access to plugin
      if (isAuthError(err)) {
        err.isHandled = true;
        return Promise.reject(err);
      }

      logPluginSettingsError('PluginProxy: calling plugin proxy failed', err, { pluginId });
      return Promise.reject(err);
    });
}

interface CallArgs extends Pick<BaseArgs, 'pluginId' | 'routePath'> {
  showErrorAlert?: boolean;
  apiVersion?: string;
}

/**
 * Send a GET request to an app plugin's configured proxy route.
 * @param options - The proxy request options.
 * @param options.pluginId - The ID of the app plugin.
 * @param options.routePath - The route path relative to the plugin's proxy endpoint, without a leading slash.
 * @param options.apiVersion - Which api version to use for the request. Defaults to the current api version.
 * @param options.showErrorAlert - Whether to show a UI error alert if the request fails. Defaults to `false`.
 * @returns The response data, or `undefined` if the available metadata identifies a non-app plugin.
 * @throws If the plugin ID is invalid, or the API version is invalid
 */
export async function callAppPluginProxy<T = unknown>({
  pluginId,
  routePath,
  apiVersion,
  showErrorAlert = false,
}: CallArgs): Promise<T | undefined> {
  const apps = await getAppPluginMetas();
  const datasources = await getDatasourcePluginMetas();
  const panels = await getPanelPluginMetas();
  const validPluginId = isValidPluginId({ pluginId, apps, datasources, panels });
  if (!validPluginId) {
    throw new Error('Invalid plugin ID');
  }

  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPluginSettings, false)) {
    return callLegacyPluginProxy<T>({ pluginId, routePath, showErrorAlert });
  }

  const meta = await getPluginMetaFromCache(pluginId);
  if (!meta) {
    logPluginSettingsDebug('PluginProxy: falling back to calling legacy plugin proxy', { pluginId });
    return callLegacyPluginProxy<T>({ pluginId, routePath, showErrorAlert });
  }

  if (meta.spec.pluginJson.type !== 'app') {
    return undefined;
  }

  const resolvedApiVersion = apiVersion ?? getApiVersion();
  const validApiVersion = isValidApiVersion(resolvedApiVersion);
  if (!validApiVersion) {
    throw new Error('Invalid API version');
  }

  return callPluginProxy({ pluginId, routePath, apiVersion: resolvedApiVersion, showErrorAlert });
}
