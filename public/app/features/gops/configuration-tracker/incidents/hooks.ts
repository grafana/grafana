import { incidentsApi } from 'app/features/alerting/unified/api/incidentsApi';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

interface IncidentsPluginConfig {
  isInstalled: boolean;
  isChatOpsInstalled: boolean;
  isIncidentCreated: boolean;
  isLoading: boolean;
}

export function useGetIncidentPluginConfig(): IncidentsPluginConfig {
  const { installed: incidentPluginInstalled, loading: loadingPluginSettings } = usePluginBridge(
    SupportedPlugin.Incident
  );
  const { data: incidentsConfig, isLoading: loadingPluginConfig } =
    incidentsApi.endpoints.getIncidentsPluginConfig.useQuery();

  return {
    isInstalled: incidentPluginInstalled ?? false,
    isChatOpsInstalled: incidentsConfig?.isChatOpsInstalled ?? false,
    isIncidentCreated: incidentsConfig?.isIncidentCreated ?? false,
    isLoading: loadingPluginSettings || loadingPluginConfig,
  };
}
