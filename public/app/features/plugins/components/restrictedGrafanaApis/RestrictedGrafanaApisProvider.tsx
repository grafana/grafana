import { PropsWithChildren, ReactElement, useEffect, useState } from 'react';

import { RestrictedGrafanaApisContextProvider, RestrictedGrafanaApisContextType } from '@grafana/data';
import { config } from '@grafana/runtime';

// This Provider is a wrapper around `RestrictedGrafanaApisContextProvider` from `@grafana/data`.
// The reason for this is that like this we only need to define the configuration once (here) and can use it in multiple places (app root page, extensions).
export function RestrictedGrafanaApisProvider({
  children,
  pluginId,
}: PropsWithChildren<{ pluginId: string }>): ReactElement {
  const [restrictedGrafanaApis, setRestrictedGrafanaApis] = useState<RestrictedGrafanaApisContextType>({});

  // Add your restricted APIs here
  // (APIs that should be availble to ALL plugins should be shared via our packages, e.g. @grafana/data.)
  useEffect(() => {
    if (!config.featureToggles.restrictedPluginApis) {
      return;
    }

    // ⚠️ Lazy-load the alerting schema to avoid bundling zod in the main app bundle
    import('app/features/plugins/components/restrictedGrafanaApis/alerting/alertRuleFormSchema').then((module) => {
      setRestrictedGrafanaApis({
        alertingAlertRuleFormSchema: module.alertingAlertRuleFormSchemaApi.alertingAlertRuleFormSchema,
      });
    });
  }, []);

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
