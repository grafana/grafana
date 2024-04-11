import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';

import { getBackendSrv } from '@grafana/runtime';
import { Button, Card, Icon, IconName, useStyles2 } from '@grafana/ui';
import { alertRuleApi } from 'app/features/alerting/unified/api/alertRuleApi';
import { alertmanagerApi } from 'app/features/alerting/unified/api/alertmanagerApi';
import { OnCallIntegrationDTO, onCallApi } from 'app/features/alerting/unified/api/onCallApi';
import { usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { useRulesSourcesWithRuler } from 'app/features/alerting/unified/hooks/useRuleSourcesWithRuler';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { fetchAllPromBuildInfoAction } from 'app/features/alerting/unified/state/actions';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { DATASOURCES_ROUTES } from 'app/features/datasources/constants';
import { useGetSingle } from 'app/features/plugins/admin/state/hooks';
import { Receiver } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { Essentials, SectionsDto } from './Essentials';
interface DataConfiguration {
  id: number;
  title: string;
  description: string;
  text: string;
  actionButtonTitle: string;
  isDone?: boolean;
  stepsDone?: number;
  titleIcon?: IconName;
}

function useGetEssentialsConfiguration() {
  const contactPoints = useGetContactPoints();
  const incidentPluginConfig = useGetIncidentPluginConfig();
  const onCallIntegrations = useGetOnCallIntegrations();
  const onCallOptions = onCallIntegrations.map((integration) => ({
    label: integration.display_name,
    value: integration.value,
  }));
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
  return ESSENTIAL_CONTENT;
}

export function ConfigureIRM() {
  const styles = useStyles2(getStyles);
  const history = useHistory();
  const dispatchReduxAction = useDispatch();
  useEffect(() => {
    dispatchReduxAction(fetchAllPromBuildInfoAction());
  }, [dispatchReduxAction]);
  const rulesSourcesWithRuler = useRulesSourcesWithRuler();

  const [essentialsOpen, setEssentialsOpen] = useState(false);
  const essentialsConfig = useGetEssentialsConfiguration();
  const configuration: DataConfiguration[] = useMemo(() => {
    return [
      {
        id: 1,
        title: 'Connect datasource to recieve data',
        description: 'Before your start configuration you need to connect at least one datasource.',
        text: 'Configure IRM',
        actionButtonTitle: 'Connect',
        isDone: rulesSourcesWithRuler.length > 0,
      },
      {
        id: 2,
        title: 'Essentials',
        titleIcon: 'star',
        description: 'Complete the basic configuration to start using the apps',
        text: 'Configure IRM',
        actionButtonTitle: 'View tasks',
      },
    ];
  }, [rulesSourcesWithRuler]);

  const handleActionClick = (configID: number) => {
    switch (configID) {
      case 1:
        history.push(DATASOURCES_ROUTES.New);
        break;
      case 2:
        setEssentialsOpen(true);
        break;
      default:
        return;
    }
  };

  return (
    <section className={styles.container}>
      {configuration.map((config) => {
        return (
          <Card key={config.id}>
            <Card.Heading className={styles.title}>
              {config.title}
              {config.titleIcon && <Icon name={config.titleIcon} />}
              {config.isDone && <Icon name="check-circle" color="green" size="lg" />}
            </Card.Heading>
            {!config.isDone && (
              <>
                <Card.Description className={styles.description}>{config.description}</Card.Description>

                <Card.Actions>
                  <Button variant="secondary" className={styles.actions} onClick={() => handleActionClick(config.id)}>
                    {config.actionButtonTitle}
                  </Button>
                </Card.Actions>
              </>
            )}
          </Card>
        );
      })}
      {essentialsOpen && (
        <AlertmanagerProvider accessType={'notification'} alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME}>
          <Essentials onClose={() => setEssentialsOpen(false)} essentialsConfig={essentialsConfig} />
        </AlertmanagerProvider>
      )}
    </section>
  );
}

const getStyles = () => ({
  container: css({
    marginBottom: 0,
    display: 'grid',
    gap: '24px',
    'grid-template-columns': ' 1fr 1fr',
  }),
  title: css({
    'justify-content': 'flex-start',
    gap: '4px',
  }),
  description: css({
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    display: '-webkit-box',
    overflow: 'hidden',
  }),
  actions: css({
    marginTop: '24px',
  }),
});

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
