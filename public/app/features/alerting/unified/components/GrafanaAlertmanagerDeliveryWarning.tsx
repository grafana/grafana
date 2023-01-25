import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Alert, useStyles2 } from '@grafana/ui/src';

import { AlertmanagerChoice } from '../../../../plugins/datasource/alertmanager/types';
import { alertmanagerApi } from '../api/alertmanagerApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

interface GrafanaAlertmanagerDeliveryWarningProps {
  currentAlertmanager: string;
}

export function GrafanaAlertmanagerDeliveryWarning({ currentAlertmanager }: GrafanaAlertmanagerDeliveryWarningProps) {
  const styles = useStyles2(getStyles);

  const { useGetAlertmanagerChoiceQuery, useGetExternalAlertmanagersQuery } = alertmanagerApi;
  const viewingInternalAm = currentAlertmanager === GRAFANA_RULES_SOURCE_NAME;

  const { currentData: alertmanagerChoice } = useGetAlertmanagerChoiceQuery();
  const { currentData: externalAMs } = useGetExternalAlertmanagersQuery();

  const externalAlertManagers = externalAMs?.activeAlertManagers ?? [];

  if (alertmanagerChoice === AlertmanagerChoice.Internal) {
    return null;
  }

  if (viewingInternalAm && alertmanagerChoice === AlertmanagerChoice.External) {
    return (
      <Alert title="Grafana alerts are not delivered to Grafana Alertmanager">
        Grafana is configured to send alerts to external Alertmanagers only. Changing Grafana Alertmanager configuration
        will not affect delivery of your alerts.
        <div className={styles.adminHint}>
          You can change the configuration on the Alerting Admin page. If you do not have access, contact your
          Administrator
        </div>
      </Alert>
    );
  }

  if (viewingInternalAm && alertmanagerChoice === AlertmanagerChoice.All && !isEmpty(externalAlertManagers)) {
    return (
      <Alert title="You have additional Alertmanagers configured" severity="warning">
        Grafana is configured to send alerts to both the internal and external Alertmanagers. Changing the internal
        Grafana Alertmanager configuration will not affect the other configured Alertmanagers.
        <div className={styles.adminHint}>
          You can change the configuration on the Alerting Admin page. If you do not have access, contact your
          Administrator
        </div>
      </Alert>
    );
  }

  return null;
}

const getStyles = (theme: GrafanaTheme2) => ({
  adminHint: css`
    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.bodySmall.fontWeight};
  `,
});
