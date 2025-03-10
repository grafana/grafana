import { useMemo } from 'react';

import { locationService } from '@grafana/runtime';
import { useGrafanaContactPoints } from 'app/features/alerting/unified/components/contact-points/useContactPoints';
import { useNotificationPolicyRoute } from 'app/features/alerting/unified/components/notification-policies/useNotificationPolicyRoute';
import {
  getIrmIfPresentOrIncidentPluginId,
  getIrmIfPresentOrOnCallPluginId,
  getIsIrmPluginPresent,
} from 'app/features/alerting/unified/utils/config';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { RelativeUrl, createRelativeUrl } from 'app/features/alerting/unified/utils/url';

import { isOnCallContactPointReady, useIsCreateAlertRuleDone } from './alerting/hooks';
import { isContactPointReady } from './alerting/utils';
import { ConfigurationStepsEnum, DataSourceConfigurationData, IrmCardConfiguration } from './components/ConfigureIRM';
import { useGetIncidentPluginConfig } from './incidents/hooks';
import { useOnCallChatOpsConnections, useOnCallOptions } from './onCall/hooks';
import { useSloChecks } from './slo/hooks';

interface UrlLink {
  url: RelativeUrl;
  queryParams?: Record<string, string>;
}
export interface StepButtonDto {
  type: 'openLink' | 'dropDown';
  label: string;
  labelOnDone?: string;
  urlLink?: UrlLink; // only for openLink
  urlLinkOnDone?: UrlLink; // only for openLink
  options?: Array<{ label: string; value: string }>; // only for dropDown
  onClickOption?: (value: string) => void; // only for dropDown
  stepNotAvailableText?: string;
}
export interface SectionDtoStep {
  title: string;
  description: string;
  button: StepButtonDto;
  done?: boolean;
}
export interface SectionDto {
  title: string;
  description: string;
  steps: SectionDtoStep[];
}
export interface SectionsDto {
  sections: SectionDto[];
}

export interface EssentialsConfigurationData {
  essentialContent: SectionsDto;
  stepsDone: number;
  totalStepsToDo: number;
  isLoading: boolean;
}

function useGetConfigurationForApps() {
  // configuration checks for alerting
  const { contactPoints, isLoading: isLoadingContactPoints } = useGrafanaContactPoints();
  const { data: rootRoute, isLoading: isLoadingDefaultContactPoint } = useNotificationPolicyRoute({
    alertmanager: GRAFANA_RULES_SOURCE_NAME,
  });
  const defaultContactpoint = rootRoute?.[0].receiver || '';
  const { isDone: isCreateAlertRuleDone, isLoading: isLoadingAlertCreatedDone } = useIsCreateAlertRuleDone();
  // configuration checks for incidents
  const {
    isChatOpsInstalled,
    isInstalled: isIncidentsInstalled,
    isLoading: isIncidentsConfigLoading,
  } = useGetIncidentPluginConfig();
  // configuration checks for oncall
  const onCallOptions = useOnCallOptions();
  const {
    is_chatops_connected,
    is_integration_chatops_connected,
    isLoading: isOnCallConfigLoading,
  } = useOnCallChatOpsConnections();
  // configuration checks for slo
  const { hasSlo, hasSloWithAlert, isLoading: isSloLoading } = useSloChecks();

  // check if any of the configurations are loading
  const isLoading =
    isLoadingContactPoints ||
    isLoadingDefaultContactPoint ||
    isLoadingAlertCreatedDone ||
    isIncidentsConfigLoading ||
    isOnCallConfigLoading ||
    isSloLoading;

  return {
    alerting: {
      contactPoints,
      defaultContactpoint,
      isCreateAlertRuleDone,
    },
    incidents: {
      isChatOpsInstalled,
      isIncidentsInstalled,
    },
    onCall: {
      onCallOptions,
      is_chatops_connected,
      is_integration_chatops_connected,
    },
    slo: {
      hasSlo,
      hasSloWithAlert,
    },
    isLoading,
  };
}

export function useGetEssentialsConfiguration(): EssentialsConfigurationData {
  const {
    alerting: { contactPoints, defaultContactpoint, isCreateAlertRuleDone },
    incidents: { isChatOpsInstalled, isIncidentsInstalled },
    onCall: { onCallOptions, is_chatops_connected, is_integration_chatops_connected },
    slo: { hasSlo, hasSloWithAlert },
    isLoading,
  } = useGetConfigurationForApps();

  function onIntegrationClick(integrationId: string, url: RelativeUrl) {
    const urlToGoWithIntegration = createRelativeUrl(`${url} + ${integrationId}`, {
      returnTo: location.pathname + location.search,
    });
    locationService.push(urlToGoWithIntegration);
  }

  function getGrafanaAlertingConfigSteps(): SectionDtoStep[] {
    let steps: SectionDtoStep[] = [
      {
        title: 'Update default contact point',
        description: 'Update the default contact point to a method other than the example email address.',
        button: {
          type: 'openLink',
          urlLink: {
            url: `/alerting/notifications`,
            queryParams: { search: defaultContactpoint, alertmanager: 'grafana' },
          },
          label: 'Edit',
          labelOnDone: 'View',
          urlLinkOnDone: {
            url: `/alerting/notifications`,
          },
        },
        done: isContactPointReady(defaultContactpoint, contactPoints),
      },
    ];

    if (!getIsIrmPluginPresent()) {
      steps = [
        ...steps,
        {
          title: 'Connect alerting to OnCall',
          description: 'Create an OnCall integration for an alerting contact point.',
          button: {
            type: 'openLink',
            urlLink: {
              url: '/alerting/notifications/receivers/new',
            },
            label: 'Connect',
            urlLinkOnDone: {
              url: '/alerting/notifications',
            },
            labelOnDone: 'View',
          },
          done: isOnCallContactPointReady(contactPoints),
        },
      ];
    }

    steps = [
      ...steps,
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
        },
        done: isCreateAlertRuleDone,
      },
      {
        title: 'Create SLO',
        description: 'Create SLOs to monitor your service.',
        button: {
          type: 'openLink',
          urlLink: {
            url: '/a/grafana-slo-app/wizard/new',
          },
          label: 'Create',
          urlLinkOnDone: {
            url: '/a/grafana-slo-app/manage-slos',
          },
          labelOnDone: 'View',
        },
        done: hasSlo,
      },
      {
        title: 'Enable SLO alerting',
        description: 'Configure SLO alerting to receive notifications when your SLOs are breached.',
        button: {
          type: 'openLink',
          urlLink: {
            queryParams: { alertsEnabled: 'disabled' },
            url: '/a/grafana-slo-app/manage-slos',
          },
          label: 'Enable',
          urlLinkOnDone: {
            queryParams: { alertsEnabled: 'enabled' },
            url: '/a/grafana-slo-app/manage-slos',
          },
          labelOnDone: 'View',
        },
        done: hasSloWithAlert,
      },
    ];

    return steps;
  }

  const essentialContent: SectionsDto = {
    sections: [
      {
        title: 'Detect',
        description: 'Configure Grafana Alerting',
        steps: getGrafanaAlertingConfigSteps(),
      },
      {
        title: 'Respond',
        description: getIsIrmPluginPresent() ? 'Configure IRM' : 'Configure OnCall and Incident',
        steps: getIsIrmPluginPresent()
          ? [
              {
                title: 'Connect alerting to IRM',
                description: 'Create an IRM integration for an alerting contact point.',
                button: {
                  type: 'openLink',
                  urlLink: {
                    url: '/alerting/notifications/receivers/new',
                  },
                  label: 'Connect',
                  urlLinkOnDone: {
                    url: '/alerting/notifications',
                  },
                  labelOnDone: 'View',
                },
                done: isOnCallContactPointReady(contactPoints),
              },
              {
                title: 'Connect IRM to your Slack workspace',
                description:
                  'Receive alerts and oncall notifications, or automatically create an incident channel and manage incidents directly within your chat environment.',
                button: {
                  type: 'openLink',
                  urlLink: {
                    url: `/a/${getIrmIfPresentOrIncidentPluginId()}/integrations/apps/grate.irm.slack`,
                  },
                  label: 'Connect',
                  urlLinkOnDone: {
                    url: `/a/${getIrmIfPresentOrIncidentPluginId()}/integrations`,
                  },
                },
                done: isChatOpsInstalled,
              },
              {
                title: 'Add Slack notifications to IRM integrations',
                description: 'Select ChatOps channels to route notifications',
                button: {
                  type: 'openLink',
                  urlLink: {
                    url: `/a/${getIrmIfPresentOrOnCallPluginId()}/integrations/`,
                  },
                  label: 'Add',
                  urlLinkOnDone: {
                    url: `/a/${getIrmIfPresentOrOnCallPluginId()}/integrations/`,
                  },
                  labelOnDone: 'View',
                },
                done: is_integration_chatops_connected,
              },
            ]
          : [
              {
                title: 'Initialize Incident plugin',
                description: 'Initialize the Incident plugin to declare and manage incidents.',
                button: {
                  type: 'openLink',
                  urlLink: {
                    url: `/a/${getIrmIfPresentOrIncidentPluginId()}/walkthrough/generate-key`,
                  },
                  label: 'Initialize',
                  urlLinkOnDone: {
                    url: `/a/${getIrmIfPresentOrIncidentPluginId()}`,
                  },
                  labelOnDone: 'View',
                },
                done: isIncidentsInstalled,
              },
              {
                title: 'Connect your Messaging workspace to OnCall',
                description: 'Receive alerts and oncall notifications within your chat environment.',
                button: {
                  type: 'openLink',
                  urlLink: {
                    url: `/a/${getIrmIfPresentOrOnCallPluginId()}/settings`,
                    queryParams: { tab: 'ChatOps', chatOpsTab: 'Slack' },
                  },
                  label: 'Connect',
                  urlLinkOnDone: {
                    url: `/a/${getIrmIfPresentOrOnCallPluginId()}/settings`,
                    queryParams: { tab: 'ChatOps' },
                  },
                  labelOnDone: 'View',
                },
                done: is_chatops_connected,
              },
              {
                title: 'Connect your Messaging workspace to Incident',
                description:
                  'Automatically create an incident channel and manage incidents directly within your chat environment.',
                button: {
                  type: 'openLink',
                  urlLink: {
                    url: `/a/${getIrmIfPresentOrIncidentPluginId()}/integrations/grate.slack`,
                  },
                  label: 'Connect',
                  urlLinkOnDone: {
                    url: `/a/${getIrmIfPresentOrIncidentPluginId()}/integrations`,
                  },
                },
                done: isChatOpsInstalled,
              },
              {
                title: 'Add Messaging workspace channel to OnCall Integration',
                description: 'Select ChatOps channels to route notifications',
                button: {
                  type: 'openLink',
                  urlLink: {
                    url: `/a/${getIrmIfPresentOrOnCallPluginId()}/integrations/`,
                  },
                  label: 'Add',
                  urlLinkOnDone: {
                    url: `/a/${getIrmIfPresentOrOnCallPluginId()}/integrations/`,
                  },
                  labelOnDone: 'View',
                },
                done: is_integration_chatops_connected,
              },
            ],
      },
      {
        title: 'Test your configuration',
        description: '',
        steps: [
          {
            title: getIsIrmPluginPresent() ? 'Send test alert' : 'Send OnCall demo alert via Alerting integration',
            description: 'In the integration page, click Send demo alert, to review your notification',
            button: {
              type: 'dropDown',
              label: 'Select integration',
              options: onCallOptions,
              onClickOption: (value) =>
                onIntegrationClick(value, `/a/${getIrmIfPresentOrOnCallPluginId()}/integrations/`),
              stepNotAvailableText: 'No integrations available',
            },
          },
          {
            title: 'Create Incident drill',
            description: 'Practice solving an Incident',
            button: {
              type: 'openLink',
              urlLink: {
                url: `/a/${getIrmIfPresentOrIncidentPluginId()}`,
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
      const stepsDone = section.steps.filter((step) => step.done).length;
      const totalStepsToForSection = section.steps.reduce((acc, step) => (step.done !== undefined ? acc + 1 : acc), 0);
      return {
        stepsDone: acc.stepsDone + stepsDone,
        totalStepsToDo: acc.totalStepsToDo + totalStepsToForSection,
      };
    },
    { stepsDone: 0, totalStepsToDo: 0 }
  );
  return { essentialContent, stepsDone, totalStepsToDo, isLoading };
}
interface UseConfigurationProps {
  dataSourceConfigurationData: DataSourceConfigurationData;
  essentialsConfigurationData: EssentialsConfigurationData;
}

export const useGetConfigurationForUI = ({
  dataSourceConfigurationData: { dataSourceCompatibleWithAlerting },
  essentialsConfigurationData: { stepsDone, totalStepsToDo },
}: UseConfigurationProps): IrmCardConfiguration[] => {
  return useMemo(() => {
    function getConnectDataSourceConfiguration() {
      const description = dataSourceCompatibleWithAlerting
        ? 'You have connected a datasource.'
        : 'Connect at least one data source to start receiving data';
      const actionButtonTitle = dataSourceCompatibleWithAlerting ? 'View' : 'Connect';
      return {
        id: ConfigurationStepsEnum.CONNECT_DATASOURCE,
        title: 'Connect data source',
        description,
        actionButtonTitle,
        isDone: dataSourceCompatibleWithAlerting,
      };
    }
    return [
      getConnectDataSourceConfiguration(),
      {
        id: ConfigurationStepsEnum.ESSENTIALS,
        title: 'Essentials',
        titleIcon: 'star',
        description: 'Set up the necessary features to start using Grafana IRM workflows',
        actionButtonTitle: stepsDone === totalStepsToDo ? 'View' : 'Configure',
        stepsDone,
        totalStepsToDo,
      },
    ];
  }, [dataSourceCompatibleWithAlerting, stepsDone, totalStepsToDo]);
};
