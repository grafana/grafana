import { useMemo, type PropsWithChildren, type ReactElement } from 'react';

import { RestrictedGrafanaApisContextProvider, type RestrictedGrafanaApisContextType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { alertingAlertRuleFormSchemaApi } from 'app/features/plugins/components/restrictedGrafanaApis/alerting/alertRuleFormSchema';

import { createDashboardMutationApi } from './dashboardMutation/dashboardMutationApi';
import { extensionSidebarApi } from './extensionSidebar/extensionSidebarApi';

const restrictedGrafanaApis: RestrictedGrafanaApisContextType = {
  alertingAlertRuleFormSchema: alertingAlertRuleFormSchemaApi.alertingAlertRuleFormSchema,
  // Always present; `canFloat()` reports whether grafana.extensionSidebarFloating lets it float.
  extensionSidebar: extensionSidebarApi,
};

// This Provider is a wrapper around `RestrictedGrafanaApisContextProvider` from `@grafana/data`.
// The reason for this is that like this we only need to define the configuration once (here) and can use it in multiple places (app root page, extensions).
export function RestrictedGrafanaApisProvider({
  children,
  pluginId,
}: PropsWithChildren<{ pluginId: string }>): ReactElement {
  const apis = useMemo(
    () => ({
      ...restrictedGrafanaApis,
      dashboardMutationAPI: createDashboardMutationApi(pluginId),
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
