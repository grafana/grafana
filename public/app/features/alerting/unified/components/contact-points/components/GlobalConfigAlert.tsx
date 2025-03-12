import { Alert, LinkButton } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { AlertmanagerAction } from '../../../hooks/useAbilities';
import { isVanillaPrometheusAlertManagerDataSource } from '../../../utils/datasource';
import { makeAMLink } from '../../../utils/misc';
import { Authorize } from '../../Authorize';

interface GlobalConfigAlertProps {
  alertManagerName: string;
}

export const GlobalConfigAlert = ({ alertManagerName }: GlobalConfigAlertProps) => {
  const isVanillaAM = isVanillaPrometheusAlertManagerDataSource(alertManagerName);

  return (
    <Authorize actions={[AlertmanagerAction.UpdateExternalConfiguration]}>
      <Alert
        severity="info"
        title={t(
          'alerting.global-config-alert.title-global-config-for-contact-points',
          'Global config for contact points'
        )}
      >
        <p>
          For each external Alertmanager you can define global settings, like server addresses, usernames and password,
          for all the supported contact points.
        </p>
        <LinkButton href={makeAMLink('alerting/notifications/global-config', alertManagerName)} variant="secondary">
          {isVanillaAM ? 'View global config' : 'Edit global config'}
        </LinkButton>
      </Alert>
    </Authorize>
  );
};
