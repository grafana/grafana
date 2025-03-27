import { onCallApi } from 'app/features/alerting/unified/api/onCallApi';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { getIrmIfPresentOrOnCallPluginId } from 'app/features/alerting/unified/utils/config';

export function useGetOnCallIntegrations() {
  const { installed: onCallPluginInstalled } = usePluginBridge(getIrmIfPresentOrOnCallPluginId());

  const { data: onCallIntegrations } = onCallApi.endpoints.grafanaOnCallIntegrations.useQuery(undefined, {
    skip: !onCallPluginInstalled,
    refetchOnFocus: true,
    refetchOnReconnect: true,
    refetchOnMountOrArgChange: true,
  });

  return onCallIntegrations ?? [];
}

function useGetOnCallConfigurationChecks() {
  const { data: onCallConfigChecks, isLoading } = onCallApi.endpoints.onCallConfigChecks.useQuery(undefined, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
    refetchOnMountOrArgChange: true,
  });

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
