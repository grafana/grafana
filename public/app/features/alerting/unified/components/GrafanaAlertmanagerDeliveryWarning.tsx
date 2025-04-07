import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { AlertmanagerChoice } from '../../../../plugins/datasource/alertmanager/types';
import { alertmanagerApi } from '../api/alertmanagerApi';
import { AlertingAction, useAlertingAbility } from '../hooks/useAbilities';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

interface GrafanaAlertmanagerDeliveryWarningProps {
  currentAlertmanager: string;
}

export function GrafanaAlertmanagerDeliveryWarning({ currentAlertmanager }: GrafanaAlertmanagerDeliveryWarningProps) {
  const styles = useStyles2(getStyles);
  const externalAlertmanager = currentAlertmanager !== GRAFANA_RULES_SOURCE_NAME;

  const [readConfigurationStatusSupported, readConfigurationStatusAllowed] = useAlertingAbility(
    AlertingAction.ReadConfigurationStatus
  );
  const canReadConfigurationStatus = readConfigurationStatusSupported && readConfigurationStatusAllowed;

  const { currentData: amChoiceStatus } = alertmanagerApi.endpoints.getGrafanaAlertingConfigurationStatus.useQuery(
    undefined,
    {
      skip: externalAlertmanager || !canReadConfigurationStatus,
    }
  );

  const interactsWithExternalAMs =
    amChoiceStatus?.alertmanagersChoice &&
    [AlertmanagerChoice.External, AlertmanagerChoice.All].includes(amChoiceStatus?.alertmanagersChoice);

  if (!interactsWithExternalAMs || externalAlertmanager) {
    return null;
  }

  const hasActiveExternalAMs = amChoiceStatus.numExternalAlertmanagers > 0;

  if (amChoiceStatus.alertmanagersChoice === AlertmanagerChoice.External) {
    return (
      <Alert
        title={t(
          'alerting.grafana-alertmanager-delivery-warning.title-grafana-alerts-delivered-alertmanager',
          'Grafana alerts are not delivered to Grafana Alertmanager'
        )}
      >
        Grafana is configured to send alerts to external Alertmanagers only. Changing Grafana Alertmanager configuration
        will not affect delivery of your alerts.
        <div className={styles.adminHint}>
          To change your Alertmanager setup, go to the Alerting Admin page. If you do not have access, contact your
          Administrator.
        </div>
      </Alert>
    );
  }

  if (amChoiceStatus.alertmanagersChoice === AlertmanagerChoice.All && hasActiveExternalAMs) {
    return (
      <Alert
        title={t(
          'alerting.grafana-alertmanager-delivery-warning.title-you-have-additional-alertmanagers-to-configure',
          'You have additional Alertmanagers to configure'
        )}
        severity="warning"
      >
        Ensure you make configuration changes in the correct Alertmanagers; both internal and external. Changing one
        will not affect the others.
        <div className={styles.adminHint}>
          To change your Alertmanager setup, go to the Alerting Admin page. If you do not have access, contact your
          Administrator.
        </div>
      </Alert>
    );
  }

  return null;
}

const getStyles = (theme: GrafanaTheme2) => ({
  adminHint: css({
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.bodySmall.fontWeight,
  }),
});
