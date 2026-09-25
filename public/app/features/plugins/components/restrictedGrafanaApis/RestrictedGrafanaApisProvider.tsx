import { useMemo, type PropsWithChildren, type ReactElement } from 'react';

import { RestrictedGrafanaApisContextProvider, type RestrictedGrafanaApisContextType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { alertingAlertRuleFormSchemaApi } from 'app/features/plugins/components/restrictedGrafanaApis/alerting/alertRuleFormSchema';

import { createDashboardMutationApi } from './dashboardMutation/dashboardMutationApi';

// This existing flag is only generated for the legacy frontend API.
// eslint-disable-next-line @grafana/no-config-feature-toggles
const restrictedApisEnabled = config.featureToggles.restrictedPluginApis;

const restrictedGrafanaApis: RestrictedGrafanaApisContextType = restrictedApisEnabled
  ? {
      alertingAlertRuleFormSchema: alertingAlertRuleFormSchemaApi.alertingAlertRuleFormSchema,
    }
  : {};

// This Provider is a wrapper around `RestrictedGrafanaApisContextProvider` from `@grafana/data`.
// The reason for this is that like this we only need to define the configuration once (here) and can use it in multiple places (app root page, extensions).
export function RestrictedGrafanaApisProvider({
  children,
  pluginId,
}: PropsWithChildren<{ pluginId: string }>): ReactElement {
  const apis = useMemo(
    () => ({
      ...restrictedGrafanaApis,
      ...(restrictedApisEnabled ? { dashboardMutationAPI: createDashboardMutationApi(pluginId) } : {}),
    }),
    [pluginId]
  );
  return (
    <RestrictedGrafanaApisContextProvider
      pluginId={pluginId}
      apis={apis}
      apiAllowList={config.bootData.settings.pluginRestrictedAPIsAllowList}
      apiBlockList={config.bootData.settings.pluginRestrictedAPIsBlockList}
    >
      {children}
    </RestrictedGrafanaApisContextProvider>
  );
}
