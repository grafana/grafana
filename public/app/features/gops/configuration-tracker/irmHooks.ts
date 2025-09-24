import { useMemo } from 'react';

import { t } from '@grafana/i18n';
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
      returnTo: window.location.pathname + window.location.search,
    });
    locationService.push(urlToGoWithIntegration);
  }

  function getGrafanaAlertingConfigSteps(): SectionDtoStep[] {
    let steps: SectionDtoStep[] = [
      {
        title: t(
          'gops.use-get-essentials-configuration.get-grafana-alerting-config-steps.steps.title.update-default-contact-point',
          'Update default contact point'
        ),
        description: 'Update the default contact point to a method other than the example email address.',
        button: {
          type: 'openLink',
          urlLink: {
            url: `/alerting/notifications`,
            queryParams: { search: defaultContactpoint, alertmanager: 'grafana' },
          },
          label: t('gops.use-get-essentials-configuration.get-grafana-alerting-config-steps.steps.label.edit', 'Edit'),
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
          title: t(
            'gops.use-get-essentials-configuration.get-grafana-alerting-config-steps.title.connect-alerting-to-on-call',
            'Connect alerting to OnCall'
          ),
          description: t(
            'gops.use-get-essentials-configuration.get-grafana-alerting-config-steps.description.create-on-call-integration-alerting-contact-point',
            'Create an OnCall integration for an alerting contact point.'
          ),
          button: {
            type: 'openLink',
            urlLink: {
              url: '/alerting/notifications/receivers/new',
            },
            label: t(
              'gops.use-get-essentials-configuration.get-grafana-alerting-config-steps.label.connect',
              'Connect'
            ),
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
        title: t(
          'gops.use-get-essentials-configuration.get-grafana-alerting-config-steps.title.create-alert-rule',
          'Create alert rule'
        ),
        description: t(
          'gops.use-get-essentials-configuration.get-grafana-alerting-config-steps.description.create-alert-monitor-system',
          'Create an alert rule to monitor your system.'
        ),
        button: {
          type: 'openLink',
          urlLink: {
            url: '/alerting/new',
          },
          label: t('gops.use-get-essentials-configuration.get-grafana-alerting-config-steps.label.create', 'Create'),
          urlLinkOnDone: {
            url: '/alerting/list',
          },
          labelOnDone: 'View',
        },
        done: isCreateAlertRuleDone,
      },
      {
        title: t(
          'gops.use-get-essentials-configuration.get-grafana-alerting-config-steps.title.create-slo',
          'Create SLO'
        ),
        description: t(
          'gops.use-get-essentials-configuration.get-grafana-alerting-config-steps.description.create-slos-to-monitor-your-service',
          'Create SLOs to monitor your service.'
        ),
        button: {
          type: 'openLink',
          urlLink: {
            url: '/a/grafana-slo-app/wizard/new',
          },
          label: t('gops.use-get-essentials-configuration.get-grafana-alerting-config-steps.label.create', 'Create'),
          urlLinkOnDone: {
            url: '/a/grafana-slo-app/manage-slos',
          },
          labelOnDone: 'View',
        },
        done: hasSlo,
      },
      {
        title: t(
          'gops.use-get-essentials-configuration.get-grafana-alerting-config-steps.title.enable-slo-alerting',
          'Enable SLO alerting'
        ),
        description: 'Configure SLO alerting to receive notifications when your SLOs are breached.',
        button: {
          type: 'openLink',
          urlLink: {
            queryParams: { alertsEnabled: 'disabled' },
            url: '/a/grafana-slo-app/manage-slos',
          },
          label: t('gops.use-get-essentials-configuration.get-grafana-alerting-config-steps.label.enable', 'Enable'),
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
        title: t('gops.use-get-essentials-configuration.essential-content.title.detect', 'Detect'),
        description: t(
          'gops.use-get-essentials-configuration.essential-content.description.configure-grafana-alerting',
          'Configure Grafana Alerting'
        ),
        steps: getGrafanaAlertingConfigSteps(),
      },
      {
        title: t('gops.use-get-essentials-configuration.essential-content.title.respond', 'Respond'),
        description: getIsIrmPluginPresent() ? 'Configure IRM' : 'Configure OnCall and Incident',
        steps: getIsIrmPluginPresent()
          ? [
              {
                title: t(
                  'gops.use-get-essentials-configuration.essential-content.title.connect-alerting-to-irm',
                  'Connect alerting to IRM'
                ),
                description: t(
                  'gops.use-get-essentials-configuration.essential-content.description.create-integration-alerting-contact-point',
                  'Create an IRM integration for an alerting contact point.'
                ),
                button: {
                  type: 'openLink',
                  urlLink: {
                    url: '/alerting/notifications/receivers/new',
                  },
                  label: t('gops.use-get-essentials-configuration.essential-content.label.connect', 'Connect'),
                  urlLinkOnDone: {
                    url: '/alerting/notifications',
                  },
                  labelOnDone: 'View',
                },
                done: isOnCallContactPointReady(contactPoints),
              },
              {
                title: t(
                  'gops.use-get-essentials-configuration.essential-content.title.connect-irm-to-your-slack-workspace',
                  'Connect IRM to your Slack workspace'
                ),
                description:
                  'Receive alerts and oncall notifications, or automatically create an incident channel and manage incidents directly within your chat environment.',
                button: {
                  type: 'openLink',
                  urlLink: {
                    url: `/a/${getIrmIfPresentOrIncidentPluginId()}/integrations/apps/grate.irm.slack`,
                  },
                  label: t('gops.use-get-essentials-configuration.essential-content.label.connect', 'Connect'),
                  urlLinkOnDone: {
                    url: `/a/${getIrmIfPresentOrIncidentPluginId()}/integrations/apps/grate.irm.slack`,
                  },
                  labelOnDone: 'View',
                },
                done: isChatOpsInstalled,
              },
              {
                title: t(
                  'gops.use-get-essentials-configuration.essential-content.title.add-slack-notifications-to-irm-integrations',
                  'Add Slack notifications to IRM integrations'
                ),
                description: t(
                  'gops.use-get-essentials-configuration.essential-content.description.select-chat-ops-channels-to-route-notifications',
                  'Select ChatOps channels to route notifications'
                ),
                button: {
                  type: 'openLink',
                  urlLink: {
                    url: `/a/${getIrmIfPresentOrOnCallPluginId()}/integrations/`,
                  },
                  label: t('gops.use-get-essentials-configuration.essential-content.label.add', 'Add'),
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
                title: t(
                  'gops.use-get-essentials-configuration.essential-content.title.initialize-incident-plugin',
                  'Initialize Incident plugin'
                ),
                description: t(
                  'gops.use-get-essentials-configuration.essential-content.description.initialize-incident-plugin-declare-manage-incidents',
                  'Initialize the Incident plugin to declare and manage incidents.'
                ),
                button: {
                  type: 'openLink',
                  urlLink: {
                    url: `/a/${getIrmIfPresentOrIncidentPluginId()}/walkthrough/generate-key`,
                  },
                  label: t('gops.use-get-essentials-configuration.essential-content.label.initialize', 'Initialize'),
                  urlLinkOnDone: {
                    url: `/a/${getIrmIfPresentOrIncidentPluginId()}`,
                  },
                  labelOnDone: 'View',
                },
                done: isIncidentsInstalled,
              },
              {
                title: t(
                  'gops.use-get-essentials-configuration.essential-content.title.connect-your-messaging-workspace-to-on-call',
                  'Connect your Messaging workspace to OnCall'
                ),
                description: t(
                  'gops.use-get-essentials-configuration.essential-content.description.receive-alerts-oncall-notifications-within-environment',
                  'Receive alerts and oncall notifications within your chat environment.'
                ),
                button: {
                  type: 'openLink',
                  urlLink: {
                    url: `/a/${getIrmIfPresentOrOnCallPluginId()}/settings`,
                    queryParams: { tab: 'ChatOps', chatOpsTab: 'Slack' },
                  },
                  label: t('gops.use-get-essentials-configuration.essential-content.label.connect', 'Connect'),
                  urlLinkOnDone: {
                    url: `/a/${getIrmIfPresentOrOnCallPluginId()}/settings`,
                    queryParams: { tab: 'ChatOps' },
                  },
                  labelOnDone: 'View',
                },
                done: is_chatops_connected,
              },
              {
                title: t(
                  'gops.use-get-essentials-configuration.essential-content.title.connect-your-messaging-workspace-to-incident',
                  'Connect your Messaging workspace to Incident'
                ),
                description:
                  'Automatically create an incident channel and manage incidents directly within your chat environment.',
                button: {
                  type: 'openLink',
                  urlLink: {
                    url: `/a/${getIrmIfPresentOrIncidentPluginId()}/integrations/grate.slack`,
                  },
                  label: t('gops.use-get-essentials-configuration.essential-content.label.connect', 'Connect'),
                  urlLinkOnDone: {
                    url: `/a/${getIrmIfPresentOrIncidentPluginId()}/integrations`,
                  },
                },
                done: isChatOpsInstalled,
              },
              {
                title: t(
                  'gops.use-get-essentials-configuration.essential-content.title.messaging-workspace-channel-on-call-integration',
                  'Add Messaging workspace channel to OnCall Integration'
                ),
                description: t(
                  'gops.use-get-essentials-configuration.essential-content.description.select-chat-ops-channels-to-route-notifications',
                  'Select ChatOps channels to route notifications'
                ),
                button: {
                  type: 'openLink',
                  urlLink: {
                    url: `/a/${getIrmIfPresentOrOnCallPluginId()}/integrations/`,
                  },
                  label: t('gops.use-get-essentials-configuration.essential-content.label.add', 'Add'),
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
        title: t(
          'gops.use-get-essentials-configuration.essential-content.title.test-your-configuration',
          'Test your configuration'
        ),
        description: '',
        steps: [
          {
            title: getIsIrmPluginPresent() ? 'Send test alert' : 'Send OnCall demo alert via Alerting integration',
            description: 'In the integration page, click Send demo alert, to review your notification',
            button: {
              type: 'dropDown',
              label: t(
                'gops.use-get-essentials-configuration.essential-content.label.select-integration',
                'Select integration'
              ),
              options: onCallOptions,
              onClickOption: (value) =>
                onIntegrationClick(value, `/a/${getIrmIfPresentOrOnCallPluginId()}/integrations/`),
              stepNotAvailableText: 'No integrations available',
            },
          },
          {
            title: t(
              'gops.use-get-essentials-configuration.essential-content.title.create-incident-drill',
              'Create Incident drill'
            ),
            description: t(
              'gops.use-get-essentials-configuration.essential-content.description.practice-solving-an-incident',
              'Practice solving an Incident'
            ),
            button: {
              type: 'openLink',
              urlLink: {
                url: `/a/${getIrmIfPresentOrIncidentPluginId()}`,
                queryParams: { declare: 'new', drill: '1' },
              },
              label: t('gops.use-get-essentials-configuration.essential-content.label.start-drill', 'Start drill'),
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
        title: t(
          'gops.use-get-configuration-for-ui.get-connect-data-source-configuration.title.connect-data-source',
          'Connect data source'
        ),
        description,
        actionButtonTitle,
        isDone: dataSourceCompatibleWithAlerting,
      };
    }
    return [
      getConnectDataSourceConfiguration(),
      {
        id: ConfigurationStepsEnum.ESSENTIALS,
        title: t('gops.use-get-configuration-for-ui.title.essentials', 'Essentials'),
        titleIcon: 'star',
        description: 'Set up the necessary features to start using Grafana IRM workflows',
        actionButtonTitle: stepsDone === totalStepsToDo ? 'View' : 'Configure',
        stepsDone,
        totalStepsToDo,
      },
    ];
  }, [dataSourceCompatibleWithAlerting, stepsDone, totalStepsToDo]);
};
