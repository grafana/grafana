import { PropsWithChildren, ReactElement } from 'react';

import { RestrictedGrafanaApisContextProvider, RestrictedGrafanaApisContextType } from '@grafana/data';
import { config } from '@grafana/runtime';

const restrictedGrafanaApis: RestrictedGrafanaApisContextType = config.featureToggles.restrictedPluginApis
  ? {
      // Add your restricted APIs here
      // (APIs that should be availble to ALL plugins should be shared via our packages, e.g. @grafana/data.)
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
