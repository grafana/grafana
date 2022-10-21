import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Alert, useStyles2 } from '@grafana/ui/src';

import { AlertmanagerChoice } from '../../../../plugins/datasource/alertmanager/types';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

interface GrafanaAlertmanagerDeliveryWarningProps {
  alertmanagerChoice?: AlertmanagerChoice;
  currentAlertmanager: string;
}

export function GrafanaAlertmanagerDeliveryWarning({
  alertmanagerChoice,
  currentAlertmanager,
}: GrafanaAlertmanagerDeliveryWarningProps) {
  const styles = useStyles2(getStyles);

  if (currentAlertmanager !== GRAFANA_RULES_SOURCE_NAME) {
    return null;
  }

  if (alertmanagerChoice !== AlertmanagerChoice.External) {
    return null;
  }

  return (
    <Alert title="Grafana alerts are not delivered to Grafana Alertmanager">
      Grafana is configured to send alerts to external Alertmanagers only. Changing Grafana Alertmanager configuration
      will not affect delivery of your alerts!
      <div className={styles.adminHint}>
        You can change the configuration on the Alerting Admin page. If you do not have access, contact your
        Administrator
      </div>
    </Alert>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  adminHint: css`
    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.bodySmall.fontWeight};
  `,
});
