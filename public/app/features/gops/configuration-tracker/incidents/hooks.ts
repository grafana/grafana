import { useEffect, useState } from 'react';

import { getBackendSrv } from '@grafana/runtime';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

interface IncidentsPluginConfig {
  isInstalled: boolean;
  isChatOpsInstalled: boolean;
  isIncidentCreated: boolean;
}

export function useGetIncidentPluginConfig() {
  const { installed: incidentPluginInstalled } = usePluginBridge(SupportedPlugin.Incident);
  const [config, setConfig] = useState<IncidentsPluginConfig>({
    isInstalled: false,
    isChatOpsInstalled: false,
    isIncidentCreated: false,
  });

  useEffect(() => {
    if (!incidentPluginInstalled) {
      setConfig({
        isInstalled: false,
        isChatOpsInstalled: false,
        isIncidentCreated: false,
      });
      return;
    }

    getBackendSrv()
      .post('/api/plugins/grafana-incident-app/resources/api/ConfigurationTrackerService.GetConfigurationTracker', {})
      .then((response) => {
        setConfig({
          isInstalled: true,
          isChatOpsInstalled: response.isChatOpsInstalled,
          isIncidentCreated: response.isIncidentCreated,
        });
      })
      .catch((error) => {
        console.error('Error getting incidents plugin config', error);
        setConfig({
          isInstalled: incidentPluginInstalled,
          isChatOpsInstalled: false,
          isIncidentCreated: false,
        });
      });
  }, [incidentPluginInstalled]);

  return {
    isInstalled: config.isInstalled,
    isChatOpsInstalled: config.isChatOpsInstalled,
    isIncidentCreated: config.isIncidentCreated,
  };
}
