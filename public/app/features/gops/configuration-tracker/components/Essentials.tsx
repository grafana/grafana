import { css } from '@emotion/css';
import React, { useEffect } from 'react';

import { GrafanaTheme2, urlUtil } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Button, Dropdown, Icon, LinkButton, Menu, Stack, Text, useStyles2 } from '@grafana/ui';
import { alertRuleApi } from 'app/features/alerting/unified/api/alertRuleApi';
import { alertmanagerApi } from 'app/features/alerting/unified/api/alertmanagerApi';
import { OnCallIntegrationDTO, onCallApi } from 'app/features/alerting/unified/api/onCallApi';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { useGetSingle } from 'app/features/plugins/admin/state/hooks';
import { Receiver } from 'app/plugins/datasource/alertmanager/types';

import { ConfigurationTrackerDrawer } from './ConfigurationTrackerDrawer';

export interface EssentialsProps {
  onClose: () => void;
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
  const incidentsPluginConfig = useGetSingle('grafana-incident-app');
  const isIncidentPluginInstalled = incidentsPluginConfig?.isInstalled ?? false;
  const [incidentPluginConfig, setIncidentPluginConfig] = React.useState<IncidentsPluginConfig | null>(null);

  useEffect(() => {
    if (!isIncidentPluginInstalled) {
      setIncidentPluginConfig({
        isInstalled: false,
        isChatOpsInstalled: false,
        isDrillCreated: false,
      });
    }
    const getIncidentChatoOpsnstalled = async () => {
      if (!isIncidentPluginInstalled) {
        return false;
      }
      const availableIntegrations = await getBackendSrv().get(
        '/api/plugins/grafana-incident-app/resources/api/IntegrationService.GetAvailableIntegrations'
      );

      const isSackInstalled = availableIntegrations?.find(
        (integration: { id: string }) => integration.id === 'grate.slack'
      );
      const isMSTeamsInstalled = availableIntegrations?.find(
        (integration: { id: string }) => integration.id === 'grate.msTeams'
      );
      return isSackInstalled || isMSTeamsInstalled;
    };

    const checkIfIncidentsCreated = async () => {
      const isDrillCreated = await getBackendSrv()
        .get('/api/plugins/grafana-incident-app/resources/api/IncidentsService.QueryIncidents')
        .then((response) => response.incidents.length > 0);
      return isDrillCreated;
    };
    if (isIncidentPluginInstalled) {
      Promise.all([getIncidentChatoOpsnstalled(), checkIfIncidentsCreated()]).then(
        ([isChatOpsInstalled, isDrillCreated]) =>
          setIncidentPluginConfig({
            isInstalled: true,
            isChatOpsInstalled,
            isDrillCreated,
          })
      );
    }
  }, [isIncidentPluginInstalled]);
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

export function Essentials({ onClose }: EssentialsProps) {
  const contactPoints = useGetContactPoints();
  const incidentPluginConfig = useGetIncidentPluginConfig();
  const onCallIntegrations = useGetOnCallIntegrations();

  const ESSENTIAL_CONTENT: SectionsDto = {
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
              url: '/alerting/notifications',
              label: 'Connect',
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
              url: '/alerting/test',
              label: 'Select integration',
              options: [{ label: 'integration 1', value: '1' }],
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

  return (
    <ConfigurationTrackerDrawer
      title="Essentials"
      subtitle="Complete basic recommended configuration to start using apps basic features"
      onClose={onClose}
    >
      <EssentialContent essentialContent={ESSENTIAL_CONTENT} />
    </ConfigurationTrackerDrawer>
  );
}
interface StepButtonDto {
  type: 'openLink' | 'dropDown';
  url: string;
  label: string;
  options?: [{ label: string; value: string }];
  done?: boolean;
}
interface SectionDto {
  title: string;
  description: string;
  steps: Array<{
    title: string;
    description: string;
    button: StepButtonDto;
  }>;
}
interface SectionsDto {
  sections: SectionDto[];
}

function EssentialContent({ essentialContent }: { essentialContent: SectionsDto }) {
  return (
    <>
      {essentialContent.sections.map((section: SectionDto) => (
        <Section key={section.title} section={section} />
      ))}
    </>
  );
}

function Section({ section }: { section: SectionDto }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      <Text element="h4">{section.title}</Text>

      <Text color="secondary">{section.description}</Text>
      <Stack direction={'column'} gap={2}>
        {section.steps.map((step, index) => (
          <Step key={index} step={step} />
        ))}
      </Stack>
    </div>
  );
}

function Step({ step }: { step: SectionDto['steps'][0] }) {
  return (
    <Stack direction={'row'} justifyContent={'space-between'}>
      <Stack direction={'row'} alignItems="center">
        {step.button.done ? <Icon name="check-circle" color="green" /> : <Icon name="circle" />}
        <Text variant="body">{step.title}</Text>
        <Icon name="question-circle" />
      </Stack>
      {!step.button.done && <StepButton {...step.button} />}
    </Stack>
  );
}

function StepButton({ type, url, label, options, done }: StepButtonDto) {
  const urlToGo = urlUtil.renderUrl(url, {
    returnTo: location.pathname + location.search,
  });
  switch (type) {
    case 'openLink':
      return (
        <LinkButton href={urlToGo} variant="secondary">
          {label}
        </LinkButton>
      );
    case 'dropDown':
      return (
        <Dropdown
          overlay={
            <Menu>
              {options?.map((option) => <Menu.Item label={option.label} onClick={() => {}} key={option.label} />)}
            </Menu>
          }
        >
          <Button variant="secondary" size="md">
            {label}
            <Icon name="angle-down" />
          </Button>
        </Dropdown>
      );
  }
}
const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      margin: theme.spacing(2, 0),
      padding: theme.spacing(2),
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
  };
};

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
