import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { AlertManagerDataSource } from '../utils/datasource';

interface Props {
  availableAlertManagers: AlertManagerDataSource[];
}

const NoAlertManagersAvailable = () => {
  return (
    <Alert
      title={t('alerting.no-alert-managers-available.title-no-alertmanager-found', 'No Alertmanager found')}
      severity="warning"
    >
      <Trans i18nKey="alerting.no-alert-managers-available.body-no-alertmanager-found">
        We could not find any external Alertmanagers and you may not have access to the built-in Grafana Alertmanager.
      </Trans>
    </Alert>
  );
};

const OtherAlertManagersAvailable = () => {
  return (
    <Alert
      title={t(
        'alerting.other-alert-managers-available.title-selected-alertmanager-not-found',
        'Selected Alertmanager not found.'
      )}
      severity="warning"
    >
      <Trans i18nKey="alerting.other-alert-managers-available.body-selected-alertmanager-not-found">
        The selected Alertmanager no longer exists or you may not have permission to access it. You can select a
        different Alertmanager from the dropdown.
      </Trans>
    </Alert>
  );
};

export const NoAlertManagerWarning = ({ availableAlertManagers }: Props) => {
  const hasOtherAMs = availableAlertManagers.length > 0;

  return <div>{hasOtherAMs ? <OtherAlertManagersAvailable /> : <NoAlertManagersAvailable />}</div>;
};
