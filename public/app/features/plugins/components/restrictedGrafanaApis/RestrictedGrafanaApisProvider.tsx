import { useMemo, type PropsWithChildren, type ReactElement } from 'react';

import { RestrictedGrafanaApisContextProvider } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useFlagGrafanaDashboardComposer, useFlagGrafanaNotebookComposer } from '@grafana/runtime/internal';

import { composerApi } from './composer/composerApi';
import { createDashboardMutationApi } from './dashboardMutation/dashboardMutationApi';
import { getRestrictedGrafanaApis, restrictedApisEnabled } from './restrictedGrafanaApis';

// This Provider is a wrapper around `RestrictedGrafanaApisContextProvider` from `@grafana/data`.
// The reason for this is that like this we only need to define the configuration once (here) and can use it in multiple places (app root page, extensions).
export function RestrictedGrafanaApisProvider({
  children,
  pluginId,
}: PropsWithChildren<{ pluginId: string }>): ReactElement {
  const mutationApi = useMemo(
    () => (restrictedApisEnabled ? createDashboardMutationApi(pluginId) : undefined),
    [pluginId]
  );
  // Composer exists only while one of its flags is on; flipping it off removes the API (and ends open
  // sessions). Each resource still checks its own flag.
  const dashboardComposerEnabled = useFlagGrafanaDashboardComposer();
  const notebookComposerEnabled = useFlagGrafanaNotebookComposer();
  const composerEnabled = dashboardComposerEnabled || notebookComposerEnabled;
  const apis = useMemo(
    () => ({
      ...getRestrictedGrafanaApis({ dashboardMutationAPI: mutationApi }),
      ...(restrictedApisEnabled && composerEnabled ? { composer: composerApi } : {}),
    }),
    [mutationApi, composerEnabled]
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
