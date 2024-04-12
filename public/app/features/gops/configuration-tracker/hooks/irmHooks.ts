import { useEffect, useState } from 'react';

import { getBackendSrv } from '@grafana/runtime';
import { alertRuleApi } from 'app/features/alerting/unified/api/alertRuleApi';
import { alertmanagerApi } from 'app/features/alerting/unified/api/alertmanagerApi';
import { OnCallIntegrationDTO, onCallApi } from 'app/features/alerting/unified/api/onCallApi';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { useGetSingle } from 'app/features/plugins/admin/state/hooks';
import { Receiver } from 'app/plugins/datasource/alertmanager/types';

import { SectionsDto } from '../components/Essentials';

function isCreateAlertRuleDone() {
  const { data: namespaces = [] } = alertRuleApi.endpoints.prometheusRuleNamespaces.useQuery(
    {
      ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
    },
    {
      refetchOnFocus: true,
      refetchOnReconnect: true,
      refetchOnMountOrArgChange: true,
    }
  );
  return namespaces.length > 0;
}

function isContactPointReady(contactPoints: Receiver[]) {
  // We consider the contact point ready if the default contact has the address filled or if there is at least one contact point created by the user

  const defaultEmailUpdated = contactPoints.some(
    (contactPoint: Receiver) =>
      contactPoint.name === 'grafana-default-email' &&
      contactPoint.grafana_managed_receiver_configs?.some(
        (receiver) => receiver.name === 'grafana-default-email' && receiver.settings?.address !== '<example@email.com>'
      )
  );
  const hasAnotherContactPoint = contactPoints.some((contactPoint: Receiver) =>
    contactPoint.grafana_managed_receiver_configs?.some((receiver) => receiver.name !== 'grafana-default-email')
  );
  return defaultEmailUpdated || hasAnotherContactPoint;
}

function isOnCallContactPointReady(contactPoints: Receiver[]) {
  return contactPoints.some((contactPoint: Receiver) =>
    contactPoint.grafana_managed_receiver_configs?.some((receiver) => receiver.type === 'oncall')
  );
}

function isOnCallIntegrationReady(onCallIntegrations: OnCallIntegrationDTO[]) {
  return onCallIntegrations.length > 0;
}

interface IncidentsPluginConfig {
  isInstalled: boolean;
  isChatOpsInstalled: boolean;
  isDrillCreated: boolean;
}

function useGetContactPoints() {
  const alertmanagerConfiguration = alertmanagerApi.endpoints.getAlertmanagerConfiguration.useQuery(
    GRAFANA_RULES_SOURCE_NAME,
    {
      refetchOnFocus: true,
      refetchOnReconnect: true,
      refetchOnMountOrArgChange: true,
    }
  );

  const contactPoints = alertmanagerConfiguration.data?.alertmanager_config?.receivers ?? [];
  return contactPoints;
}

function useGetIncidentPluginConfig() {
  const { installed: isIncidentPluginInstalled } = usePluginBridge(SupportedPlugin.Incident);
  const [incidentPluginConfig, setIncidentPluginConfig] = useState<IncidentsPluginConfig | null>(null);

  useEffect(() => {
    if (!isIncidentPluginInstalled) {
      setIncidentPluginConfig({
        isInstalled: false,
        isChatOpsInstalled: false,
        isDrillCreated: false,
      });
      return;
    }

    const checkIfIncidentsCreated = async () => {
      const isDrillCreated = await getBackendSrv()
        .get('/api/plugins/grafana-incident-app/resources/api/IncidentsService.QueryIncidents')
        .then((response) => response.incidents.length > 0);
      return isDrillCreated;
    };

    const getIncidentChatOpsInstalled = async () => {
      if (!isIncidentPluginInstalled) {
        return false;
      }
      const availableIntegrations = await getBackendSrv().get(
        '/api/plugins/grafana-incident-app/resources/api/IntegrationService.GetAvailableIntegrations'
      );
  
      const isSlackInstalled = availableIntegrations?.find(
        integration => integration.id === 'grate.slack'
      );
      const isMSTeamsInstalled = availableIntegrations?.find(
        integration => integration.id === 'grate.msTeams'
      );
      return isSlackInstalled || isMSTeamsInstalled;
    };

    const fetchData = async () => {
      const [isChatOpsInstalled, isDrillCreated] = await Promise.all([
        getIncidentChatOpsInstalled(),
        checkIfIncidentsCreated()
      ]);
      setIncidentPluginConfig({
        isInstalled: true,
        isChatOpsInstalled,
        isDrillCreated
      });
    };
  
    fetchData();
  }, [isIncidentPluginInstalled, setIncidentPluginConfig]);
  

  console.log(incidentPluginConfig);
  return incidentPluginConfig;
}

function useGetOnCallIntegrations() {
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

export function useGetEssentialsConfiguration() {
  const contactPoints = useGetContactPoints();
  const incidentPluginConfig = useGetIncidentPluginConfig();
  const onCallIntegrations = useGetOnCallIntegrations();
  const onCallOptions = onCallIntegrations.map((integration) => ({
    label: integration.display_name,
    value: integration.value,
  }));
  const { is_chatops_connected, is_integration_chatops_connected } = useGetOnCallConfigurationChecks();

  const essentialContent: SectionsDto = {
    sections: [
      {
        title: 'Detect',
        description: 'Configure alerting',
        steps: [
          {
            title: 'Contact point ready',
            description: 'tbd',
            button: {
              type: 'openLink',
              url: '/alerting/notifications',
              label: 'Update',
              done: isContactPointReady(contactPoints),
            },
          },
          {
            title: 'Create alert rule',
            description: 'tbd',
            button: {
              type: 'openLink',
              url: '/alerting/new',
              label: 'Create',
              done: isCreateAlertRuleDone(),
            },
          },
          {
            title: 'Create OnCall contact point',
            description: 'tbd',
            button: {
              type: 'openLink',
              url: '/alerting/notifications',
              label: 'View',
              done: isOnCallContactPointReady(contactPoints),
            },
          },
        ],
      },
      {
        title: 'Respond',
        description: 'Configure OnCall and Incident',
        steps: [
          {
            title: 'Initialize Incident plugin',
            description: 'tbd',
            button: {
              type: 'openLink',
              url: '/a/grafana-incident-app/walkthrough/generate-key',
              label: 'Initialize',
              done: incidentPluginConfig?.isInstalled,
            },
          },
          {
            title: 'Create OnCall integration to receive Alerts',
            description: 'tbd',
            button: {
              type: 'openLink',
              url: '/a/grafana-oncall-app/integrations?tab=monitoring-systems&p=1',
              label: 'View',
              done: isOnCallIntegrationReady(onCallIntegrations),
            },
          },
          {
            title: 'Create your ChatOps workspace to OnCall',
            description: 'tbd',
            button: {
              type: 'openLink',
              url: '/alerting/notifications',
              label: 'Connect',
              done: is_chatops_connected,
            },
          },
          {
            title: 'Create your ChatOps workspace to Incident',
            description: 'tbd',
            button: {
              type: 'openLink',
              url: '/a/grafana-incident-app/integrations/grate.slack',
              label: 'Connect',
              done: incidentPluginConfig?.isChatOpsInstalled,
            },
          },
          {
            title: 'Add ChatOps to your integration',
            description: 'tbd',
            button: {
              type: 'openLink',
              url: '/a/grafana-oncall-app/integrations/',
              label: 'Connect',
              done: is_integration_chatops_connected,
            },
          },
        ],
      },
      {
        title: 'Test your config',
        description: '',
        steps: [
          {
            title: 'Send OnCall demo alert',
            description: 'tbd',
            button: {
              type: 'dropDown',
              url: '/a/grafana-oncall-app/integrations/',
              label: 'Select integration',
              options: onCallOptions,
            },
          },
          {
            title: 'Create Incident drill',
            description: 'tbd',
            button: {
              type: 'openLink',
              url: '/a/grafana-incident-app?declare=new&drill=1',
              label: 'Start drill',
              done: incidentPluginConfig?.isDrillCreated,
            },
          },
        ],
      },
    ],
  };
  return essentialContent;
}
