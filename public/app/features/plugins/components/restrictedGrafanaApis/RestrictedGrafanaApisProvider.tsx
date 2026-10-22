import { ProviderEvents } from '@openfeature/react-sdk';
import { useMemo, useSyncExternalStore, type PropsWithChildren, type ReactElement } from 'react';

import { RestrictedGrafanaApisContextProvider, type RestrictedGrafanaApisContextType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { alertingAlertRuleFormSchemaApi } from 'app/features/plugins/components/restrictedGrafanaApis/alerting/alertRuleFormSchema';

import { composerApi } from './composer/composerApi';
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
  const mutationApi = useMemo(() => createDashboardMutationApi(pluginId), [pluginId]);
  // Composer exists only while its flag is on; flipping it off removes the API (and ends open sessions).
  const composerEnabled = useComposerEnabled();
  const apis = useMemo(
    () => ({
      ...restrictedGrafanaApis,
      dashboardMutationAPI: mutationApi,
      ...(composerEnabled ? { composer: composerApi } : {}),
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

/**
 * Whether Composer's flag is on, kept current. Read from the flag client rather than the React OpenFeature
 * hooks: extension components get this provider wherever they render, and not every place they render has an
 * OpenFeatureProvider above it.
 */
function useComposerEnabled(): boolean {
  return useSyncExternalStore(subscribeToFlagChanges, isComposerEnabled);
}

function isComposerEnabled(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaDashboardComposer, false);
}

const FLAG_CHANGE_EVENTS = [ProviderEvents.Ready, ProviderEvents.ConfigurationChanged] as const;

function subscribeToFlagChanges(onChange: () => void): () => void {
  const client = getFeatureFlagClient();
  FLAG_CHANGE_EVENTS.forEach((event) => client.addHandler(event, onChange));
  return () => FLAG_CHANGE_EVENTS.forEach((event) => client.removeHandler(event, onChange));
}
