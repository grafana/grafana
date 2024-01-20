import { capitalize } from 'lodash';
import React from 'react';

import { Badge, Button, Card, Dropdown, Menu, Stack } from '@grafana/ui';
import { AlertmanagerChoice, ExternalAlertmanagerConfig } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { useExternalDataSourceAlertmanagers } from '../../hooks/useExternalAmSelector';
import MoreButton from '../MoreButton';

export const ExternalAlertmanagers = () => {
  const dataSourceAlertmanagers = useExternalDataSourceAlertmanagers();
  const { currentData: deliverySettings } = alertmanagerApi.endpoints.getExternalAlertmanagerConfig.useQuery();

  const isReceiving = isReceivingOnExternalAlertmanagers(deliverySettings);

  return (
    <>
      {dataSourceAlertmanagers.map((alertmanager) => {
        const { uid, name, url, jsonData } = alertmanager.dataSource;
        const implementation = jsonData.implementation ?? 'Prometheus';

        return (
          <Card key={uid}>
            <Card.Heading>{name}</Card.Heading>
            <Card.Figure>
              <img alt="Alertmanager logo" src="public/app/plugins/datasource/alertmanager/img/logo.svg" />
            </Card.Figure>

            <Card.Meta>
              {capitalize(implementation)}
              {url}
            </Card.Meta>
            <Card.Description>
              {isReceiving ? (
                <Badge text="Receiving Grafana-managed alerts" color="green" />
              ) : (
                <Badge text="Not receiving Grafana-managed alerts" color="orange" />
              )}
            </Card.Description>
            <Card.Tags>
              <Stack direction="row" gap={1}>
                <Button icon="pen" variant="secondary" fill="outline">
                  Edit configuration
                </Button>
                <Dropdown
                  overlay={
                    <Menu>
                      <Menu.Item icon="eye" label="View" />
                      <Menu.Divider />
                      <Menu.Item icon="times" label="Remove" />
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

// if we have either "external" or "both" configured this means the internal Alertmanager is receiving Grafana-managed alerts
const isReceivingOnExternalAlertmanagers = (config?: ExternalAlertmanagerConfig): boolean => {
  const INTERNAL_RECEIVING = [AlertmanagerChoice.External, AlertmanagerChoice.All];
  return INTERNAL_RECEIVING.some((choice) => config?.alertmanagersChoice === choice);
};
