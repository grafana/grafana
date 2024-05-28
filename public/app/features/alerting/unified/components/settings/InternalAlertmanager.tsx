import React from 'react';

import { ConnectionStatus } from '../../hooks/useExternalAmSelector';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { isInternalAlertmanagerInterestedInAlerts } from '../../utils/settings';

import { AlertmanagerCard } from './AlertmanagerCard';
import { useSettings } from './SettingsContext';

interface Props {
  onEditConfiguration: (dataSourceName: string) => void;
}

export const BUILTIN_ALERTMANAGER_NAME = 'Grafana built-in';

export default function InternalAlertmanager({ onEditConfiguration }: Props) {
  const { configuration, enableAlertmanager, disableAlertmanager, forwardingDisabled } = useSettings();

  const isReceiving = isInternalAlertmanagerInterestedInAlerts(configuration);
  const status: ConnectionStatus = isReceiving ? 'active' : 'uninterested';
  const handleEditConfiguration = () => onEditConfiguration(GRAFANA_RULES_SOURCE_NAME);

  return (
    <AlertmanagerCard
      name={BUILTIN_ALERTMANAGER_NAME}
      logo="public/img/grafana_icon.svg"
      status={status}
      receiving={isReceiving}
      forwardingDisabled={forwardingDisabled}
      onEditConfiguration={handleEditConfiguration}
      onEnable={() => enableAlertmanager(GRAFANA_RULES_SOURCE_NAME)}
      onDisable={() => disableAlertmanager(GRAFANA_RULES_SOURCE_NAME)}
    />
  );
}
