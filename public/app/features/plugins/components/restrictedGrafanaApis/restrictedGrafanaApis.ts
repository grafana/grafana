import { type DashboardMutationAPI, type RestrictedGrafanaApisContextType } from '@grafana/data';
import { getAllowedRestrictedGrafanaApis } from '@grafana/data/internal';
import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { alertingAlertRuleFormSchemaApi } from 'app/features/plugins/components/restrictedGrafanaApis/alerting/alertRuleFormSchema';

import { composerApi } from './composer/composerApi';
import { extensionSidebarApi } from './extensionSidebar/extensionSidebarApi';

const sharedApis: RestrictedGrafanaApisContextType = {
  alertingAlertRuleFormSchema: alertingAlertRuleFormSchemaApi.alertingAlertRuleFormSchema,
  // Always present; `canFloat()` reports whether grafana.extensionSidebarFloating lets it float.
  extensionSidebar: extensionSidebarApi,
};

/** Whether one of Composer's flags is on now: Composer exists while it is. */
export function isComposerEnabled(): boolean {
  const flags = getFeatureFlagClient();
  return (
    flags.getBooleanValue(FlagKeys.GrafanaDashboardComposer, false) ||
    flags.getBooleanValue(FlagKeys.GrafanaNotebookComposer, false)
  );
}

/**
 * Every restricted API Grafana offers, before the allow and block lists pick a plugin's share. Composer exists
 * only while one of its flags is on; each resource still checks its own flag.
 */
export function getRestrictedGrafanaApis({
  composerEnabled,
  dashboardMutationAPI,
}: {
  composerEnabled: boolean;
  dashboardMutationAPI?: DashboardMutationAPI;
}): RestrictedGrafanaApisContextType {
  return {
    ...sharedApis,
    ...(dashboardMutationAPI ? { dashboardMutationAPI } : {}),
    ...(composerEnabled ? { composer: composerApi } : {}),
  };
}

/**
 * What `pluginId` gets at load, for `AppPlugin.onRestrictedApis`: the same objects RestrictedGrafanaApisProvider
 * provides its roots, under the same allow and block lists, with any feature flags as they are now. The id is
 * the one Grafana loads the module for, never one the plugin names. The Dashboard Mutation API is left out: it
 * acts on what the plugin's mounted roots show, so it stays with the provider.
 */
export function getRestrictedGrafanaApisAtLoad(pluginId: string): RestrictedGrafanaApisContextType {
  return getAllowedRestrictedGrafanaApis({
    pluginId,
    apis: getRestrictedGrafanaApis({ composerEnabled: isComposerEnabled() }),
    apiAllowList: config.bootData.settings.pluginRestrictedAPIsAllowList,
    apiBlockList: config.bootData.settings.pluginRestrictedAPIsBlockList,
  });
}
