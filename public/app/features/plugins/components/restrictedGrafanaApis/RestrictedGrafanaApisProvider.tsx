import { type PropsWithChildren, type ReactElement } from 'react';

import { RestrictedGrafanaApisContextProvider, type RestrictedGrafanaApisContextType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { alertingAlertRuleFormSchemaApi } from 'app/features/plugins/components/restrictedGrafanaApis/alerting/alertRuleFormSchema';

import { dashboardMutationApi } from './dashboardMutation/dashboardMutationApi';
import { extensionSidebarApi } from './extensionSidebar/extensionSidebarApi';

const restrictedGrafanaApis: RestrictedGrafanaApisContextType = config.featureToggles.restrictedPluginApis
  ? {
      alertingAlertRuleFormSchema: alertingAlertRuleFormSchemaApi.alertingAlertRuleFormSchema,
      dashboardMutationAPI: dashboardMutationApi,
      // Always present; `canFloat()` reports whether grafana.extensionSidebarFloating lets it float.
      extensionSidebar: extensionSidebarApi,
    }
  : {};

// This Provider is a wrapper around `RestrictedGrafanaApisContextProvider` from `@grafana/data`.
// The reason for this is that like this we only need to define the configuration once (here) and can use it in multiple places (app root page, extensions).
export function RestrictedGrafanaApisProvider({
  children,
  pluginId,
}: PropsWithChildren<{ pluginId: string }>): ReactElement {
  return (
    <RestrictedGrafanaApisContextProvider
      pluginId={pluginId}
      apis={restrictedGrafanaApis}
      apiAllowList={config.bootData.settings.pluginRestrictedAPIsAllowList}
      apiBlockList={config.bootData.settings.pluginRestrictedAPIsBlockList}
    >
      {children}
    </RestrictedGrafanaApisContextProvider>
  );
}
