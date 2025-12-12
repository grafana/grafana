import { onCallApi } from 'app/features/alerting/unified/api/onCallApi';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';

import { useIrmConfig } from '../irmHooks';

export function useGetOnCallIntegrations() {
  const {
    irmConfig: { onCallPluginId },
    isIrmConfigLoading,
  } = useIrmConfig();
  const { installed: onCallPluginInstalled } = usePluginBridge(onCallPluginId);

  const { data: onCallIntegrations } = onCallApi(onCallPluginId).endpoints.grafanaOnCallIntegrations.useQuery(
    undefined,
    {
      skip: !onCallPluginInstalled || isIrmConfigLoading,
      refetchOnFocus: true,
      refetchOnReconnect: true,
      refetchOnMountOrArgChange: true,
    }
  );

  return onCallIntegrations ?? [];
}

function useGetOnCallConfigurationChecks() {
  const {
    irmConfig: { onCallPluginId },
    isIrmConfigLoading,
  } = useIrmConfig();
  const { data: onCallConfigChecks, isLoading } = onCallApi(onCallPluginId).endpoints.onCallConfigChecks.useQuery(
    undefined,
    {
      refetchOnFocus: true,
      refetchOnReconnect: true,
      refetchOnMountOrArgChange: true,
    }
  );

  return {
    isLoading: isLoading || isIrmConfigLoading,
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
