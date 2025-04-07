import { Alert } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { AlertManagerDataSource } from '../utils/datasource';

interface Props {
  availableAlertManagers: AlertManagerDataSource[];
}

const NoAlertManagersAvailable = () => (
  <Alert
    title={t('alerting.no-alert-managers-available.title-no-alertmanager-found', 'No Alertmanager found')}
    severity="warning"
  >
    We could not find any external Alertmanagers and you may not have access to the built-in Grafana Alertmanager.
  </Alert>
);

const OtherAlertManagersAvailable = () => (
  <Alert
    title={t(
      'alerting.other-alert-managers-available.title-selected-alertmanager-not-found',
      'Selected Alertmanager not found.'
    )}
    severity="warning"
  >
    The selected Alertmanager no longer exists or you may not have permission to access it. You can select a different
    Alertmanager from the dropdown.
  </Alert>
);

export const NoAlertManagerWarning = ({ availableAlertManagers }: Props) => {
  const hasOtherAMs = availableAlertManagers.length > 0;

  return <div>{hasOtherAMs ? <OtherAlertManagersAvailable /> : <NoAlertManagersAvailable />}</div>;
};
