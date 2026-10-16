import { type ComponentType, type PropsWithChildren, type ReactElement } from 'react';

import { RestrictedGrafanaApisContextProvider, type RestrictedGrafanaApisContextType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { alertingAlertRuleFormSchemaApi } from 'app/features/plugins/components/restrictedGrafanaApis/alerting/alertRuleFormSchema';

import { dashboardDataApi } from './dashboardData/dashboardDataApi';
import { dashboardMutationApi } from './dashboardMutation/dashboardMutationApi';

const restrictedGrafanaApis: RestrictedGrafanaApisContextType = config.featureToggles.restrictedPluginApis
  ? {
      alertingAlertRuleFormSchema: alertingAlertRuleFormSchemaApi.alertingAlertRuleFormSchema,
      dashboardMutationAPI: dashboardMutationApi,
      dashboardDataAPI: dashboardDataApi,
    }
  : {};

// This Provider is a wrapper around `RestrictedGrafanaApisContextProvider` from `@grafana/data`.
// The reason for this is that like this we only need to define the configuration once (here) and can use it in multiple places (app root page, extensions, panels).
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

/** For plugin components that Grafana renders outside a plugin page or extension, such as panels. */
export function withRestrictedGrafanaApis<P extends object>(
  Component: ComponentType<P>,
  pluginId: string
): ComponentType<P> {
  const WithRestrictedGrafanaApis = (props: P) => (
    <RestrictedGrafanaApisProvider pluginId={pluginId}>
      <Component {...props} />
    </RestrictedGrafanaApisProvider>
  );
  WithRestrictedGrafanaApis.displayName = `WithRestrictedGrafanaApis(${Component.displayName ?? Component.name})`;
  return WithRestrictedGrafanaApis;
}
