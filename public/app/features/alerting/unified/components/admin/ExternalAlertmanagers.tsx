import React from 'react';

import { Badge, Button, Card, Dropdown, Menu, Stack } from '@grafana/ui';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import {
  ExternalAlertmanagerDataSourceWithStatus,
  useExternalDataSourceAlertmanagers,
} from '../../hooks/useExternalAmSelector';
import MoreButton from '../MoreButton';

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
        const { uid, name } = alertmanager.dataSourceSettings;
        const { status } = alertmanager;

        const isReceiving = isReceivingOnAlertmanager(alertmanager);

        return (
          <Card key={uid}>
            <Card.Heading>{name}</Card.Heading>
            <Card.Figure>
              <img alt="Alertmanager logo" src="public/app/plugins/datasource/alertmanager/img/logo.svg" />
            </Card.Figure>

            <Card.Meta>
              {status === 'uninterested' && 'Not receiving Grafana-managed alerts'}
              {status === 'pending' && <Badge text="Activation in progress" color="orange" />}
              {status === 'active' && <Badge text="Receiving Grafana-managed alerts" color="green" />}
              {status === 'dropped' && <Badge text="Failed to adopt Alertmanager" color="red" />}
              {status === 'inconclusive' && <Badge text="Inconclusive" color="orange" />}
            </Card.Meta>

            {/* we'll use the "tags" to append buttons and actions */}
            <Card.Tags>
              <Stack direction="row" gap={1}>
                <Button onClick={onEditConfiguration} icon="pen" variant="secondary" fill="outline">
                  Edit configuration
                </Button>
                <Dropdown
                  overlay={
                    <Menu>
                      <Menu.Item icon="eye" label="View" />
                      <Menu.Divider />
                      {isReceiving ? (
                        <Menu.Item icon="toggle-on" label="Disable" destructive />
                      ) : (
                        <Menu.Item icon="toggle-off" label="Enable" />
                      )}
                    </Menu>
                  }
                >
                  <MoreButton fill="outline" size="md" />
                </Dropdown>
              </Stack>
            </Card.Tags>
          </Card>
        );
      })}
    </>
  );
};
