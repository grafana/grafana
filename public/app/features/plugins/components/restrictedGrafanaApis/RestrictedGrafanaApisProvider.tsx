import { ProviderEvents } from '@openfeature/react-sdk';
import { useMemo, useSyncExternalStore, type PropsWithChildren, type ReactElement } from 'react';

import { RestrictedGrafanaApisContextProvider } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getFeatureFlagClient } from '@grafana/runtime/internal';

import { createDashboardMutationApi } from './dashboardMutation/dashboardMutationApi';
import { getRestrictedGrafanaApis, isComposerEnabled } from './restrictedGrafanaApis';

// This Provider is a wrapper around `RestrictedGrafanaApisContextProvider` from `@grafana/data`.
// The reason for this is that like this we only need to define the configuration once (here) and can use it in multiple places (app root page, extensions).
export function RestrictedGrafanaApisProvider({
  children,
  pluginId,
}: PropsWithChildren<{ pluginId: string }>): ReactElement {
  const mutationApi = useMemo(() => createDashboardMutationApi(pluginId), [pluginId]);
  // Composer exists only while one of its flags is on; flipping it off removes the API (and ends open
  // sessions). Each resource still checks its own flag.
  const composerEnabled = useComposerEnabled();
  const apis = useMemo(
    () => getRestrictedGrafanaApis({ composerEnabled, dashboardMutationAPI: mutationApi }),
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

/**
 * Whether one of Composer's flags is on, kept current. Read from the flag client rather than the React
 * OpenFeature hooks: extension components get this provider wherever they render, and not every place they
 * render has an OpenFeatureProvider above it.
 */
function useComposerEnabled(): boolean {
  return useSyncExternalStore(subscribeToFlagChanges, isComposerEnabled);
}

const FLAG_CHANGE_EVENTS = [ProviderEvents.Ready, ProviderEvents.ConfigurationChanged] as const;

function subscribeToFlagChanges(onChange: () => void): () => void {
  const client = getFeatureFlagClient();
  FLAG_CHANGE_EVENTS.forEach((event) => client.addHandler(event, onChange));
  return () => FLAG_CHANGE_EVENTS.forEach((event) => client.removeHandler(event, onChange));
}
