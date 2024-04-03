import React from 'react';

import { Badge, Button, Card, Stack, Text } from '@grafana/ui';
import { AlertmanagerChoice, ExternalAlertmanagerConfig } from 'app/plugins/datasource/alertmanager/types';

import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { useSettings } from './SettingsContext';

interface Props {
  onEditConfiguration: (dataSourceName: string) => void;
}

export default function InternalAlertmanager({ onEditConfiguration }: Props) {
  const { deliverySettings, enableAlertmanager, disableAlertmanager } = useSettings();

  const isReceiving = isReceivingOnInternalAlertmanager(deliverySettings);
  const handleEditConfiguration = () => onEditConfiguration(GRAFANA_RULES_SOURCE_NAME);

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
          <Text variant="bodySmall">Not receiving Grafana-managed alerts</Text>
        )}
      </Card.Meta>

      <Card.Tags>
        <Stack direction="row" gap={1}>
          <Button icon="edit" variant="secondary" fill="outline" onClick={handleEditConfiguration}>
            Edit configuration
          </Button>
          {isReceiving ? (
            <Button
              icon="times"
              variant="destructive"
              fill="outline"
              onClick={() => disableAlertmanager(GRAFANA_RULES_SOURCE_NAME)}
            >
              Disable
            </Button>
          ) : (
            <Button
              icon="check"
              variant="secondary"
              fill="outline"
              onClick={() => enableAlertmanager(GRAFANA_RULES_SOURCE_NAME)}
            >
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
