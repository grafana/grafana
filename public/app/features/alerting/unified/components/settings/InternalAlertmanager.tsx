import React from 'react';

import { ConnectionStatus } from '../../hooks/useExternalAmSelector';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { isInternalAlertmanagerInterestedInAlerts } from '../../utils/settings';

import { AlertmanagerCard } from './AlertmanagerCard';
import { useSettings } from './SettingsContext';

interface Props {
  onEditConfiguration: (dataSourceName: string) => void;
}

export default function InternalAlertmanager({ onEditConfiguration }: Props) {
  const { configuration, enableAlertmanager, disableAlertmanager } = useSettings();

  const isReceiving = isInternalAlertmanagerInterestedInAlerts(configuration);
  const status: ConnectionStatus = isReceiving ? 'active' : 'uninterested';
  const handleEditConfiguration = () => onEditConfiguration(GRAFANA_RULES_SOURCE_NAME);

  return (
    <AlertmanagerCard
      name="Grafana built-in"
      logo="public/img/grafana_icon.svg"
      status={status}
      receiving={isReceiving}
      onEditConfiguration={handleEditConfiguration}
      onEnable={() => enableAlertmanager(GRAFANA_RULES_SOURCE_NAME)}
      onDisable={() => disableAlertmanager(GRAFANA_RULES_SOURCE_NAME)}
    />
  );
}
