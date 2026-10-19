import { type RestrictedGrafanaApisContextType } from '@grafana/data';
import { isRestrictedGrafanaApiAllowed } from '@grafana/data/internal';
import { config } from '@grafana/runtime';

/**
 * Whether `RestrictedGrafanaApisProvider` gives `pluginId` the restricted API `api`, for code outside the plugin's
 * React tree. Uses the same feature toggle and the same allow and block lists as the provider.
 */
export function isRestrictedGrafanaApiAvailable(
  api: keyof RestrictedGrafanaApisContextType,
  pluginId: string
): boolean {
  // This existing flag is only generated for the legacy frontend API.
  // eslint-disable-next-line @grafana/no-config-feature-toggles
  if (!config.featureToggles.restrictedPluginApis) {
    return false;
  }
  return isRestrictedGrafanaApiAllowed(
    api,
    pluginId,
    config.bootData.settings.pluginRestrictedAPIsAllowList,
    config.bootData.settings.pluginRestrictedAPIsBlockList
  );
}
