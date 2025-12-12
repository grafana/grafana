import { incidentsApi } from 'app/features/alerting/unified/api/incidentsApi';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';

import { useIrmConfig } from '../irmHooks';

interface IncidentsPluginConfig {
  isInstalled: boolean;
  isChatOpsInstalled: boolean;
  isIncidentCreated: boolean;
  isLoading: boolean;
}

export function useGetIncidentPluginConfig(): IncidentsPluginConfig {
  const {
    irmConfig: { incidentPluginId },
    isIrmConfigLoading,
  } = useIrmConfig();
  const { installed: incidentPluginInstalled, loading: loadingPluginSettings } = usePluginBridge(incidentPluginId);
  const { data: incidentsConfig, isLoading: loadingPluginConfig } =
    incidentsApi(incidentPluginId).endpoints.getIncidentsPluginConfig.useQuery();

  return {
    isInstalled: incidentPluginInstalled ?? false,
    isChatOpsInstalled: incidentsConfig?.isChatOpsInstalled ?? false,
    isIncidentCreated: incidentsConfig?.isIncidentCreated ?? false,
    isLoading: loadingPluginSettings || loadingPluginConfig || isIrmConfigLoading,
  };
}
