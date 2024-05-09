import { useEffect, useState } from 'react';

import { getBackendSrv, locationService } from '@grafana/runtime';
import { alertRuleApi } from 'app/features/alerting/unified/api/alertRuleApi';
import { alertmanagerApi } from 'app/features/alerting/unified/api/alertmanagerApi';
import { onCallApi } from 'app/features/alerting/unified/api/onCallApi';
import { useDataSourceFeatures } from 'app/features/alerting/unified/hooks/useCombinedRule';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { createUrl } from 'app/features/alerting/unified/utils/url';
import { Receiver } from 'app/plugins/datasource/alertmanager/types';

interface UrlLink {
  url: string;
  queryParams?: Record<string, string>;
}
export interface StepButtonDto {
  type: 'openLink' | 'dropDown';
  label: string;
  labelOnDone?: string;
  done?: boolean;
  urlLink?: UrlLink; // only for openLink
  urlLinkOnDone?: UrlLink; // only for openLink
  options?: Array<{ label: string; value: string }>; // only for dropDown
  onClickOption?: (value: string) => void; // only for dropDown
}
export interface SectionDtoStep {
  title: string;
  description: string;
  button: StepButtonDto;
}
export interface SectionDto {
  title: string;
  description: string;
  steps: SectionDtoStep[];
}
export interface SectionsDto {
  sections: SectionDto[];
}

function useIsCreateAlertRuleDone() {
  const [fetchRulerRules, { data }] = alertRuleApi.endpoints.rulerRules.useLazyQuery({
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const { dsFeatures } = useDataSourceFeatures(GRAFANA_RULES_SOURCE_NAME);
  const rulerConfig = dsFeatures?.rulerConfig;

  useEffect(() => {
    rulerConfig && fetchRulerRules({ rulerConfig });
  }, [rulerConfig, fetchRulerRules]);

  const rules = data
    ? Object.entries(data).flatMap(([_, groupDto]) => {
        return groupDto.flatMap((group) => group.rules);
      })
    : [];
  return rules.length > 0;
}

function isContactPointReady(defaultContactPoint: string, contactPoints: Receiver[]) {
  // We consider the contact point ready if the default contact has the address filled

  const defaultEmailUpdated = contactPoints.some(
    (contactPoint: Receiver) =>
      contactPoint.name === defaultContactPoint &&
      contactPoint.grafana_managed_receiver_configs?.some(
        (receiver) => receiver.name === defaultContactPoint && receiver.settings?.address !== '<example@email.com>'
      )
  );
  return defaultEmailUpdated;
}

function isOnCallContactPointReady(contactPoints: Receiver[]) {
  return contactPoints.some((contactPoint: Receiver) =>
    contactPoint.grafana_managed_receiver_configs?.some((receiver) => receiver.type === 'oncall')
  );
}

interface IncidentsPluginConfig {
  isInstalled: boolean;
  isChatOpsInstalled: boolean;
  isIncidentCreated: boolean;
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

function useGetDefaultContactPoint() {
  const alertmanagerConfiguration = alertmanagerApi.endpoints.getAlertmanagerConfiguration.useQuery(
    GRAFANA_RULES_SOURCE_NAME,
    {
      refetchOnFocus: true,
      refetchOnReconnect: true,
      refetchOnMountOrArgChange: true,
    }
  );

  return alertmanagerConfiguration.data?.alertmanager_config?.route?.receiver ?? '';
}

function useGetIncidentPluginConfig() {
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

function useOnCallOptions() {
  const onCallIntegrations = useGetOnCallIntegrations();
  return onCallIntegrations.map((integration) => ({
    label: integration.display_name,
    value: integration.value,
  }));
}

function useOnCallChatOpsConnections() {
  const { is_chatops_connected, is_integration_chatops_connected } = useGetOnCallConfigurationChecks();
  return { is_chatops_connected, is_integration_chatops_connected };
}

export interface EssentialsConfigurationData {
  essentialContent: SectionsDto;
  stepsDone: number;
  totalStepsToDo: number;
}

export function useGetEssentialsConfiguration(): EssentialsConfigurationData {
  const contactPoints = useGetContactPoints();
  const defaultContactPoint = useGetDefaultContactPoint();
  const incidentPluginConfig = useGetIncidentPluginConfig();
  const onCallOptions = useOnCallOptions();
  const chatOpsConnections = useOnCallChatOpsConnections();
  function onIntegrationClick(integrationId: string, url: string) {
    const urlToGoWithIntegration = createUrl(url + integrationId, {
      returnTo: location.pathname + location.search,
    });
    locationService.push(urlToGoWithIntegration);
  }

  const essentialContent: SectionsDto = {
    sections: [
      {
        title: 'Detect',
        description: 'Configure Grafana Alerting',
        steps: [
          {
            title: 'Update default email contact point',
            description: 'Add a valid email to the default email contact point.',
            button: {
              type: 'openLink',
              urlLink: {
                url: `/alerting/notifications/receivers/${defaultContactPoint}/edit`,
                queryParams: { alertmanager: 'grafana' },
              },
              label: 'Edit',
              labelOnDone: 'View',
              urlLinkOnDone: {
                url: `/alerting/notifications`,
              },
              done: isContactPointReady(defaultContactPoint, contactPoints),
            },
          },
          {
            title: 'Connect alerting to OnCall',
            description: 'OnCall allows precisely manage your on-call strategy and use multiple channels to deliver',
            button: {
              type: 'openLink',
              urlLink: {
                url: '/alerting/notifications/receivers/new',
              },
              label: 'Connect',
              done: isOnCallContactPointReady(contactPoints),
              urlLinkOnDone: {
                url: '/alerting/notifications',
              },
              labelOnDone: 'View',
            },
          },
          {
            title: 'Create alert rule',
            description: 'Create an alert rule to monitor your system.',
            button: {
              type: 'openLink',
              urlLink: {
                url: '/alerting/new',
              },
              label: 'Create',
              urlLinkOnDone: {
                url: '/alerting/list',
              },
              labelOnDone: 'View',
              done: useIsCreateAlertRuleDone(),
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
            description: 'Initialize the Incident plugin to declare and manage incidents.',
            button: {
              type: 'openLink',
              urlLink: {
                url: '/a/grafana-incident-app/walkthrough/generate-key',
              },
              label: 'Initialize',
              urlLinkOnDone: {
                url: '/a/grafana-incident-app',
              },
              labelOnDone: 'View',
              done: incidentPluginConfig?.isInstalled,
            },
          },
          {
            title: 'Connect your Messaging workspace to OnCall',
            description: 'Receive alerts and oncall notifications within your chat environment.',
            button: {
              type: 'openLink',
              urlLink: {
                url: '/a/grafana-oncall-app/settings',
                queryParams: { tab: 'ChatOps', chatOpsTab: 'Slack' },
              },
              label: 'Connect',
              urlLinkOnDone: {
                url: '/a/grafana-oncall-app/settings',
                queryParams: { tab: 'ChatOps' },
              },
              labelOnDone: 'View',
              done: chatOpsConnections.is_chatops_connected,
            },
          },
          {
            title: 'Connect your Messaging workspace to Incident',
            description:
              'Automatically create an incident channel and manage incidents directly within your chat environment.',
            button: {
              type: 'openLink',
              urlLink: {
                url: '/a/grafana-incident-app/integrations/grate.slack',
              },
              label: 'Connect',
              urlLinkOnDone: {
                url: '/a/grafana-incident-app/integrations',
              },
              done: incidentPluginConfig?.isChatOpsInstalled,
            },
          },
          {
            title: 'Add Messaging workspace channel to OnCall Integration',
            description: 'Select ChatOps channels to route notifications',
            button: {
              type: 'openLink',
              urlLink: {
                url: '/a/grafana-oncall-app/integrations/',
              },
              label: 'Add',
              urlLinkOnDone: {
                url: '/a/grafana-oncall-app/integrations/',
              },
              labelOnDone: 'View',
              done: chatOpsConnections.is_integration_chatops_connected,
            },
          },
        ],
      },
      {
        title: 'Test your configuration',
        description: '',
        steps: [
          {
            title: 'Send OnCall demo alert',
            description: 'In the integration page, click Send demo alert, to review your notification',
            button: {
              type: 'dropDown',
              label: 'Select integration',
              options: onCallOptions,
              onClickOption: (value) => onIntegrationClick(value, '/a/grafana-oncall-app/integrations/'),
            },
          },
          {
            title: 'Create Incident drill',
            description: 'Practice solving an Incident',
            button: {
              type: 'openLink',
              urlLink: {
                url: '/a/grafana-incident-app',
                queryParams: { declare: 'new', drill: '1' },
              },
              label: 'Start drill',
            },
          },
        ],
      },
    ],
  };
  const { stepsDone, totalStepsToDo } = essentialContent.sections.reduce(
    (acc, section) => {
      const stepsDone = section.steps.filter((step) => step.button.done).length;
      const totalStepsToForSection = section.steps.reduce(
        (acc, step) => (step.button.done !== undefined ? acc + 1 : acc),
        0
      );
      return {
        stepsDone: acc.stepsDone + stepsDone,
        totalStepsToDo: acc.totalStepsToDo + totalStepsToForSection,
      };
    },
    { stepsDone: 0, totalStepsToDo: 0 }
  );
  return { essentialContent, stepsDone, totalStepsToDo };
}
