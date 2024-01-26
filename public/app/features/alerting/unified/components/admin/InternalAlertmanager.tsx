import React from 'react';

import { Badge, Button, Card, Stack } from '@grafana/ui';
import { AlertmanagerChoice, ExternalAlertmanagerConfig } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';

interface Props {
  onEditConfiguration: () => void;
}

export default function InternalAlertmanager({ onEditConfiguration }: Props) {
  const { currentData: deliverySettings, isLoading = true } =
    alertmanagerApi.endpoints.getExternalAlertmanagerConfig.useQuery();

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
          'Not receiving Grafana-managed alerts'
        )}
      </Card.Meta>
      <Card.Tags>
        <Stack direction="row" gap={1}>
          <Button icon="pen" variant="secondary" fill="outline" onClick={onEditConfiguration}>
            Edit configuration
          </Button>
          {isReceiving ? (
            <Button icon="times" variant="destructive" fill="outline" disabled={isLoading}>
              Disable
            </Button>
          ) : (
            <Button icon="check" variant="secondary" fill="outline" disabled={isLoading}>
              Enable
            </Button>
          )}
        </Stack>
      </Card.Tags>
    </Card>
  );
}

// if we have either "internal" or "both" configured this means the internal Alertmanager is receiving Grafana-managed alerts
const isReceivingOnInternalAlertmanager = (config?: ExternalAlertmanagerConfig): boolean => {
  const INTERNAL_RECEIVING = [AlertmanagerChoice.Internal, AlertmanagerChoice.All];
  return INTERNAL_RECEIVING.some((choice) => config?.alertmanagersChoice === choice);
};
