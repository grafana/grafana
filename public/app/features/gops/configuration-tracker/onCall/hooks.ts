import { onCallApi } from 'app/features/alerting/unified/api/onCallApi';
import { useIrmPlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

export function useGetOnCallIntegrations() {
  const { pluginId, installed: onCallPluginInstalled } = useIrmPlugin(SupportedPlugin.OnCall);

  const { data: onCallIntegrations } = onCallApi.endpoints.grafanaOnCallIntegrations.useQuery(
    { pluginId },
    {
      skip: !onCallPluginInstalled,
      refetchOnFocus: true,
      refetchOnReconnect: true,
      refetchOnMountOrArgChange: true,
    }
  );

  return onCallIntegrations ?? [];
}

function useGetOnCallConfigurationChecks() {
  const { pluginId } = useIrmPlugin(SupportedPlugin.OnCall);

  const { data: onCallConfigChecks, isLoading } = onCallApi.endpoints.onCallConfigChecks.useQuery(
    { pluginId },
    {
      refetchOnFocus: true,
      refetchOnReconnect: true,
      refetchOnMountOrArgChange: true,
    }
  );

  return {
    isLoading,
    onCallConfigChecks: onCallConfigChecks ?? { is_chatops_connected: false, is_integration_chatops_connected: false },
  };
}

export function useOnCallOptions() {
  const onCallIntegrations = useGetOnCallIntegrations();
  return onCallIntegrations.map((integration) => ({
    label: integration.display_name,
    value: integration.value,
  }));
}

export function useOnCallChatOpsConnections() {
  const {
    onCallConfigChecks: { is_chatops_connected, is_integration_chatops_connected },
    isLoading,
  } = useGetOnCallConfigurationChecks();
  return { is_chatops_connected, is_integration_chatops_connected, isLoading };
}
