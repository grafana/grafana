import React from 'react';

import { Alert } from '@grafana/ui/src';

import { AlertmanagerChoice } from '../../../../plugins/datasource/alertmanager/types';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

interface GrafanaAlertmanagerDisabledWarningProps {
  alertmanagerChoice?: AlertmanagerChoice;
  currentAlertmanager: string;
}

export function GrafanaAlertmanagerDisabledWarning({
  alertmanagerChoice,
  currentAlertmanager,
}: GrafanaAlertmanagerDisabledWarningProps) {
  if (currentAlertmanager !== GRAFANA_RULES_SOURCE_NAME) {
    return null;
  }

  if (alertmanagerChoice !== AlertmanagerChoice.External) {
    return null;
  }

  return (
    <Alert title="Grafana Alertmanager is currently disabled">
      Grafana is configured to send alerts to external Alertmanagers only Changing Grafana Alertmanager configuration
      will not affect your alerts!
    </Alert>
  );
}
