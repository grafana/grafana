import { Trans, t } from '@grafana/i18n';
import { Alert, LinkButton } from '@grafana/ui';

import { isGranted } from '../../../hooks/abilities/abilityUtils';
import { useExternalAlertmanagerAbility } from '../../../hooks/abilities/useExternalAlertmanagerAbility';;

import { ExternalAlertmanagerAction } from '../../../hooks/abilities/types';
import { isVanillaPrometheusAlertManagerDataSource } from '../../../utils/datasource';
import { makeAMLink } from '../../../utils/misc';

interface GlobalConfigAlertProps {
  alertManagerName: string;
}

export const GlobalConfigAlert = ({ alertManagerName }: GlobalConfigAlertProps) => {
  const isVanillaAM = isVanillaPrometheusAlertManagerDataSource(alertManagerName);
  const canUpdate = isGranted(useExternalAlertmanagerAbility(ExternalAlertmanagerAction.UpdateExternalConfiguration));

  if (!canUpdate) {
    return null;
  }

  return (
    <Alert
      severity="info"
      title={t(
        'alerting.global-config-alert.title-global-config-for-contact-points',
        'Global config for contact points'
      )}
    >
      <p>
        <Trans i18nKey="alerting.global-config-alert.body">
          For each external Alertmanager you can define global settings, like server addresses, usernames and password,
          for all the supported contact points.
        </Trans>
      </p>
      <LinkButton href={makeAMLink('alerting/notifications/global-config', alertManagerName)} variant="secondary">
        {isVanillaAM
          ? t('alerting.global-config-alert.view-global-config', 'View global config')
          : t('alerting.global-config-alert.edit-global-config', 'Edit global config')}
      </LinkButton>
    </Alert>
  );
};
