import React from 'react';

import { Badge, Button, Card } from '@grafana/ui';
import { AlertmanagerChoice, ExternalAlertmanagerConfig } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';

export default function InternalAlertmanager() {
  const { currentData: deliverySettings } = alertmanagerApi.endpoints.getExternalAlertmanagerConfig.useQuery();

  const isReceiving = isReceivingOnInternalAlertmanager(deliverySettings);

  return (
    <Card>
      <Card.Heading>Grafana built-in</Card.Heading>
      <Card.Figure>
        <img alt="Grafana logo" src="public/img/grafana_icon.svg" />
      </Card.Figure>

      <Card.Meta>
        {isReceiving ? (
          <Badge text="Receiving Grafana-managed alerts" color="green" />
        ) : (
          <Badge text="Not receiving Grafana-managed alerts" color="orange" />
        )}
      </Card.Meta>
      <Card.Tags>
        <Button icon="pen" variant="secondary" fill="outline">
          Edit configuration
        </Button>
      </Card.Tags>
    </Card>
  );
}

// if we have either "internal" or "both" configured this means the internal Alertmanager is receiving Grafana-managed alerts
const isReceivingOnInternalAlertmanager = (config?: ExternalAlertmanagerConfig): boolean => {
  const INTERNAL_RECEIVING = [AlertmanagerChoice.Internal, AlertmanagerChoice.All];
  return INTERNAL_RECEIVING.some((choice) => config?.alertmanagersChoice === choice);
};
