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
  const { currentData: alertmanagerChoice } = useGetAlertmanagerChoiceQuery();

  const viewingInternalAM = currentAlertmanager === GRAFANA_RULES_SOURCE_NAME;

  const interactsWithExternalAMs =
    alertmanagerChoice && [AlertmanagerChoice.External, AlertmanagerChoice.All].includes(alertmanagerChoice);

  const fetchExternalAMs = viewingInternalAM && interactsWithExternalAMs;

  // only fetch external AMs when we have the right admin config
  const { currentData: externalAMs } = useGetExternalAlertmanagersQuery(undefined, {
    skip: !fetchExternalAMs,
  });

  if (!interactsWithExternalAMs) {
    return null;
  }

  const externalAlertManagers = externalAMs?.activeAlertManagers ?? [];
  const hasActiveExternalAMs = !isEmpty(externalAlertManagers);

  if (alertmanagerChoice === AlertmanagerChoice.External && hasActiveExternalAMs) {
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

  if (alertmanagerChoice === AlertmanagerChoice.All && hasActiveExternalAMs) {
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
