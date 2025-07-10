import { FilterAlertReceiveChannelRead } from '@grafana/hackathon-13-registrar-private/rtk-query';
import { onCallApi, onCallApiFromRegistrar } from 'app/features/alerting/unified/api/onCallApi';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { getIrmIfPresentOrOnCallPluginId } from 'app/features/alerting/unified/utils/config';

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
  const { installed: onCallPluginInstalled } = usePluginBridge(getIrmIfPresentOrOnCallPluginId());
  const onCallIntegrations = onCallApiFromRegistrar.useAlertReceiveChannelsListQuery(
    {},
    {
      skip: !onCallPluginInstalled,
      refetchOnFocus: true,
      refetchOnReconnect: true,
      refetchOnMountOrArgChange: true,
    }
  );
  return onCallIntegrations.data?.results.map((integration) => {
    const integrationRead = integration as FilterAlertReceiveChannelRead;
    return {
      label: integrationRead.display_name,
      value: integrationRead.value,
    };
  });
}

export function useOnCallChatOpsConnections() {
  const {
    onCallConfigChecks: { is_chatops_connected, is_integration_chatops_connected },
    isLoading,
  } = useGetOnCallConfigurationChecks();
  return { is_chatops_connected, is_integration_chatops_connected, isLoading };
}
