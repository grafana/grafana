import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';
import { type HealthCheckResult, HealthStatus } from '../../utils/DataSourceWithBackend';
import { getBackendSrv, isFetchError } from '../backendSrv';
import { getPluginMetaFromCache } from '../pluginMeta/plugins';
import { logPluginSettingsDebug, logPluginSettingsError } from '../pluginSettings/logging';
import { getApiVersion, getNamespace, isAuthError } from '../pluginUtils';

interface K8sHealthCheckResult extends Omit<HealthCheckResult, 'message'> {
  message?: string;
}

function isUnhealthyHealthCheckError(err: unknown): boolean {
  return (
    isFetchError<HealthCheckResult>(err) &&
    err.status === 400 &&
    (err.data?.status === HealthStatus.Error || err.data?.status === HealthStatus.Unknown)
  );
}

function getLegacyAppHealth(pluginId: string, showErrorAlert?: boolean): Promise<HealthCheckResult> {
  const options = { showErrorAlert, validatePath: true };

  return getBackendSrv()
    .get<HealthCheckResult>(`/api/plugins/${pluginId}/health`, undefined, undefined, options)
    .catch((err) => {
      // User does not have access to plugin
      if (isAuthError(err)) {
        err.isHandled = true;
        return Promise.reject(err);
      }

      if (isUnhealthyHealthCheckError(err)) {
        return err.data;
      }

      logPluginSettingsError('PluginHealth: getting legacy plugin health failed', err, { pluginId });
      return Promise.reject(err);
    });
}

function getAppHealth(pluginId: string, apiVersion: string, showErrorAlert?: boolean): Promise<HealthCheckResult> {
  const options = { showErrorAlert, validatePath: true };

  return getBackendSrv()
    .get<K8sHealthCheckResult>(
      `/apis/${pluginId}/${apiVersion}/namespaces/${getNamespace()}/app/instance/health`,
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

      if (isUnhealthyHealthCheckError(err)) {
        return err.data;
      }

      logPluginSettingsError('PluginHealth: getting plugin health failed', err, { pluginId });
      return Promise.reject(err);
    })
    .then((health) => ({ ...health, message: health.message ?? '' })); // make sure there is always a message property, even if the backend doesn't return one
}

/**
 * Get the health for a plugin.
 * @param pluginId - The id of the plugin.
 * @param showErrorAlert - Whether to show a UI error alert if the request fails.
 * @param apiVersion - Which api version to use for the request. Defaults to the current api version.
 * @returns The plugin's `HealthCheckResult`, or `undefined` for non-app plugins
 * when k8s metadata is available.
 */
export async function getAppPluginHealth(
  pluginId: string,
  showErrorAlert = false,
  apiVersion = getApiVersion()
): Promise<HealthCheckResult | undefined> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPluginSettings, false)) {
    return getLegacyAppHealth(pluginId, showErrorAlert);
  }

  const meta = await getPluginMetaFromCache(pluginId);
  if (!meta) {
    logPluginSettingsDebug('PluginHealth: falling back to getting legacy plugin health', { pluginId });
    return getLegacyAppHealth(pluginId, showErrorAlert);
  }

  if (meta.spec.pluginJson.type !== 'app') {
    return undefined;
  }

  return getAppHealth(pluginId, apiVersion, showErrorAlert);
}
