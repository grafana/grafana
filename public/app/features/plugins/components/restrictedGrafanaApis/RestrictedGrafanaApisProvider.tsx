import { PropsWithChildren, ReactElement } from 'react';
import { type GenericSchema, parse, safeParse } from 'valibot';

import { RestrictedGrafanaApisContextProvider, RestrictedGrafanaApisContextType, SchemaValidator } from '@grafana/data';
import { config } from '@grafana/runtime';
import { alertingAlertRuleFormSchemaApi } from 'app/features/plugins/components/restrictedGrafanaApis/alerting/alertRuleFormSchema';

import { dashboardMutationApi } from './dashboardMutation/dashboardMutationApi';

function wrapValibotSchema(schema: GenericSchema): SchemaValidator {
  return {
    parse: (data: unknown) => parse(schema, data),
    safeParse: (data: unknown) => {
      const result = safeParse(schema, data);
      return result.success ? { success: true, data: result.output } : { success: false, error: result.issues };
    },
  };
}

const restrictedGrafanaApis: RestrictedGrafanaApisContextType = config.featureToggles.restrictedPluginApis
  ? {
      alertingAlertRuleFormSchema: wrapValibotSchema(alertingAlertRuleFormSchemaApi.alertingAlertRuleFormSchema),
      dashboardMutationAPI: dashboardMutationApi,
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
