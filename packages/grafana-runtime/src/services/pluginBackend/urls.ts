import { config } from '../../config';
import { getFeatureFlagClient } from '../../internal/openFeature';
import { FlagKeys } from '../../internal/openFeature/openfeature.gen';

function getApiVersion(): string {
  return 'v0alpha1';
}

function getNamespace(): string {
  return config.namespace;
}

function isMTBackendEnabled(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.PluginsUseMTPluginBackend, false);
}

function k8sBase(pluginId: string): string {
  return `/apis/${pluginId}/${getApiVersion()}/namespaces/${getNamespace()}/app/instance`;
}

/**
 * Build the URL for an app plugin resource call.
 * @param pluginId - The id of the app plugin.
 * @param path - Sub-path under the resources endpoint. Should include a leading `/`.
 */
export function buildAppPluginResourceUrl(pluginId: string, path: string): string {
  if (!isMTBackendEnabled()) {
    return `/api/plugins/${pluginId}/resources${path}`;
  }
  return `${k8sBase(pluginId)}/resources${path}`;
}

/**
 * Build the URL for an app plugin health check.
 * @param pluginId - The id of the app plugin.
 */
export function buildAppPluginHealthUrl(pluginId: string): string {
  if (!isMTBackendEnabled()) {
    return `/api/plugins/${pluginId}/health`;
  }
  return `${k8sBase(pluginId)}/health`;
}

/**
 * Build the URL for an app plugin proxy call.
 * @param pluginId - The id of the app plugin.
 * @param path - Sub-path under the proxy endpoint. Should include a leading `/`.
 */
export function buildAppPluginProxyUrl(pluginId: string, path: string): string {
  if (!isMTBackendEnabled()) {
    return `/api/plugins/${pluginId}/proxy${path}`;
  }
  return `${k8sBase(pluginId)}/proxy${path}`;
}
