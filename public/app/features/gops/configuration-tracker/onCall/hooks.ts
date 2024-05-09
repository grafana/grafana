import { onCallApi } from 'app/features/alerting/unified/api/onCallApi';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

export function useGetOnCallIntegrations() {
  const { installed: onCallPluginInstalled } = usePluginBridge(SupportedPlugin.OnCall);

  const { data: onCallIntegrations } = onCallApi.endpoints.grafanaOnCallIntegrations.useQuery(undefined, {
    skip: !onCallPluginInstalled,
    refetchOnFocus: true,
    refetchOnReconnect: true,
    refetchOnMountOrArgChange: true,
  });

  return onCallIntegrations ?? [];
}

export function useGetOnCallConfigurationChecks() {
  const { data: onCallConfigChecks } = onCallApi.endpoints.onCallConfigChecks.useQuery(undefined, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
    refetchOnMountOrArgChange: true,
  });

  return onCallConfigChecks ?? { is_chatops_connected: false, is_integration_chatops_connected: false };
}

export function useOnCallOptions() {
  const onCallIntegrations = useGetOnCallIntegrations();
  return onCallIntegrations.map((integration) => ({
    label: integration.display_name,
    value: integration.value,
  }));
}

export function useOnCallChatOpsConnections() {
  const { is_chatops_connected, is_integration_chatops_connected } = useGetOnCallConfigurationChecks();
  return { is_chatops_connected, is_integration_chatops_connected };
}
