import { type DashboardMutationAPI, type RestrictedGrafanaApisContextType } from '@grafana/data';
import { getAllowedRestrictedGrafanaApis } from '@grafana/data/internal';
import { config } from '@grafana/runtime';
import { alertingAlertRuleFormSchemaApi } from 'app/features/plugins/components/restrictedGrafanaApis/alerting/alertRuleFormSchema';

import { extensionSidebarApi } from './extensionSidebar/extensionSidebarApi';

const sharedApis: RestrictedGrafanaApisContextType = {
  alertingAlertRuleFormSchema: alertingAlertRuleFormSchemaApi.alertingAlertRuleFormSchema,
  // Always present; `canFloat()` reports whether grafana.extensionSidebarFloating lets it float.
  extensionSidebar: extensionSidebarApi,
};

/** Every restricted API Grafana offers, before the allow and block lists pick a plugin's share. */
export function getRestrictedGrafanaApis({
  dashboardMutationAPI,
}: {
  dashboardMutationAPI?: DashboardMutationAPI;
} = {}): RestrictedGrafanaApisContextType {
  return {
    ...sharedApis,
    ...(dashboardMutationAPI ? { dashboardMutationAPI } : {}),
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
    apis: getRestrictedGrafanaApis(),
    apiAllowList: config.bootData.settings.pluginRestrictedAPIsAllowList,
    apiBlockList: config.bootData.settings.pluginRestrictedAPIsBlockList,
  });
}
