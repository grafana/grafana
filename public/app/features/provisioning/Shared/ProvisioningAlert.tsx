import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { ProvisioningErrorInfo } from '../types';

interface ProvisioningAlertProps {
  error: string | ProvisioningErrorInfo;
}

const getErrorTitle = (error: string | ProvisioningErrorInfo) => {
  if (typeof error === 'string') {
    return error;
  }
  return error.title || t('provisioning.error-title-default', 'Error');
};

const getErrorMessage = (error: string | ProvisioningErrorInfo) => {
  if (typeof error === 'string' || !error.message) {
    return null;
  }

  if (Array.isArray(error.message)) {
    return (
      <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
        {error.message.map((msg, index) => (
          <li key={index}>{msg}</li>
        ))}
      </ul>
    );
  }

  return error.message;
};

export function ProvisioningAlert({ error }: ProvisioningAlertProps) {
  return (
    <Alert severity="error" title={getErrorTitle(error)}>
      {getErrorMessage(error)}
    </Alert>
  );
}