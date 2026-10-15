import { type PropsWithChildren, type ReactElement } from 'react';

import { RestrictedGrafanaApisContextProvider } from '@grafana/data';
import { config } from '@grafana/runtime';

import { dashboardMutationApi } from './dashboardMutation/dashboardMutationApi';
import { getRestrictedGrafanaApis, restrictedApisEnabled } from './restrictedGrafanaApis';

const restrictedGrafanaApis = getRestrictedGrafanaApis({
  dashboardMutationAPI: restrictedApisEnabled ? dashboardMutationApi : undefined,
});

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
