import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, useStyles2 } from '@grafana/ui';

import { AlertmanagerChoice } from '../../../../plugins/datasource/alertmanager/types';
import { alertmanagerApi } from '../api/alertmanagerApi';
import { isGranted } from '../hooks/abilities/abilityUtils';
import { useNotificationPolicyAbility } from '../hooks/abilities/alertmanager/useNotificationPolicyAbility';
import { useSilenceAbility } from '../hooks/abilities/alertmanager/useSilenceAbility';
import { NotificationPolicyAction, SilenceAction } from '../hooks/abilities/types';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

interface GrafanaAlertmanagerWarningProps {
  currentAlertmanager: string;
}

export function GrafanaAlertmanagerWarning({ currentAlertmanager }: GrafanaAlertmanagerWarningProps) {
  return <GrafanaExternalAlertmanagerConfigWarning currentAlertmanager={currentAlertmanager} />;
}

function GrafanaExternalAlertmanagerConfigWarning({ currentAlertmanager }: GrafanaAlertmanagerWarningProps) {
  const styles = useStyles2(getStyles);
  const externalAlertmanager = currentAlertmanager !== GRAFANA_RULES_SOURCE_NAME;

  const canViewSilences = isGranted(useSilenceAbility({ action: SilenceAction.View }));
  const canViewNotificationPolicies = isGranted(
    useNotificationPolicyAbility({ action: NotificationPolicyAction.ViewTree })
  );
  const canReadConfigurationStatus = canViewSilences || canViewNotificationPolicies;

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
        <Trans i18nKey="alerting.grafana-alertmanager-delivery-warning.configuration-changes-external">
          Grafana is configured to send alerts to external Alertmanagers only. Changing Grafana Alertmanager
          configuration will not affect delivery of your alerts.
        </Trans>
        <div className={styles.adminHint}>
          <Trans i18nKey="alerting.grafana-alertmanager-delivery-warning.admin-hint-external">
            To change your Alertmanager setup, go to the Alerting Admin page. If you do not have access, contact your
            Administrator.
          </Trans>
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
        <Trans i18nKey="alerting.grafana-alertmanager-delivery-warning.configuration-changes-all">
          Ensure you make configuration changes in the correct Alertmanagers; both internal and external. Changing one
          will not affect the others.
        </Trans>
        <div className={styles.adminHint}>
          <Trans i18nKey="alerting.grafana-alertmanager-delivery-warning.admin-hint-all">
            To change your Alertmanager setup, go to the Alerting Admin page. If you do not have access, contact your
            Administrator.
          </Trans>
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
