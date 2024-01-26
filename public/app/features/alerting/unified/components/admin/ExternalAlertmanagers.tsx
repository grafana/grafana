import { capitalize } from 'lodash';
import React from 'react';

import { Badge, Button, Card, Icon, Stack, Text, TextLink } from '@grafana/ui';
import { useDataSourcesRoutes } from 'app/features/datasources/state';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import {
  ExternalAlertmanagerDataSourceWithStatus,
  useExternalDataSourceAlertmanagers,
} from '../../hooks/useExternalAmSelector';
import { createUrl } from '../../utils/url';

interface Props {
  onEditConfiguration: () => void;
}

export const ExternalAlertmanagers = ({ onEditConfiguration }: Props) => {
  const dataSourceAlertmanagers = useExternalDataSourceAlertmanagers();
  const { currentData: deliverySettings } = alertmanagerApi.endpoints.getExternalAlertmanagerConfig.useQuery(
    undefined,
    {
      refetchOnReconnect: true,
      refetchOnFocus: true,
    }
  );

  // determine if the alertmanger is receiving alerts
  // this is true if Grafana is configured to send to either "both" or "external" and the Alertmanager datasource _wants_ to receive alerts.
  const isReceivingOnAlertmanager = (
    externalDataSourceAlertmanager: ExternalAlertmanagerDataSourceWithStatus
  ): boolean => {
    const sendingToExternal = [AlertmanagerChoice.All, AlertmanagerChoice.External].some(
      (choice) => deliverySettings?.alertmanagersChoice === choice
    );
    const wantsAlertsReceived =
      externalDataSourceAlertmanager.dataSourceSettings.jsonData.handleGrafanaManagedAlerts === true;

    return sendingToExternal && wantsAlertsReceived;
  };

  return (
    <>
      {dataSourceAlertmanagers.map((alertmanager) => {
        const { uid, name, jsonData, url } = alertmanager.dataSourceSettings;
        const { status } = alertmanager;

        const isReceiving = isReceivingOnAlertmanager(alertmanager);
        const dataSourceHref = useDataSourceEditLink(uid);

        return (
          <Card key={uid}>
            <Card.Heading>
              <TextLink href={dataSourceHref}>{name}</TextLink>
            </Card.Heading>
            <Card.Figure>
              <img alt="Alertmanager logo" src="public/app/plugins/datasource/alertmanager/img/logo.svg" />
            </Card.Figure>

            <Card.Meta>
              {capitalize(jsonData.implementation ?? 'Prometheus')}
              <div>
                <Icon name="link" size="xs" /> {url}
              </div>
            </Card.Meta>

            <Card.Description>
              {!isReceiving ? (
                <Text variant="bodySmall">Not receiving Grafana-managed alerts</Text>
              ) : (
                <>
                  {status === 'pending' && <Badge text="Activation in progress" color="orange" />}
                  {status === 'active' && <Badge text="Receiving Grafana-managed alerts" color="green" />}
                  {status === 'dropped' && <Badge text="Failed to adopt Alertmanager" color="red" />}
                  {status === 'inconclusive' && <Badge text="Inconclusive" color="orange" />}
                </>
              )}
            </Card.Description>

            {/* we'll use the "tags" to append buttons and actions */}
            <Card.Tags>
              <Stack direction="row" gap={1}>
                <Button onClick={onEditConfiguration} icon="pen" variant="secondary" fill="outline">
                  Edit configuration
                </Button>
                {isReceiving ? (
                  <Button icon="times" variant="destructive" fill="outline">
                    Disable
                  </Button>
                ) : (
                  <Button icon="check" variant="secondary" fill="outline">
                    Enable
                  </Button>
                )}
              </Stack>
            </Card.Tags>
          </Card>
        );
      })}
    </>
  );
};

function useDataSourceEditLink(uid: string) {
  const dataSourcesRoutes = useDataSourcesRoutes();
  const dsLink = createUrl(dataSourcesRoutes.Edit.replace(/:uid/gi, uid));

  return dsLink;
}
