import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { ProvisioningErrorInfo } from '../types';

interface ProvisioningAlertProps {
  error?: string | ProvisioningErrorInfo;
  warning?: string | ProvisioningErrorInfo;
}

const getTitle = (alert: string | ProvisioningErrorInfo, isWarning = false) => {
  if (typeof alert === 'string') {
    return alert;
  }
  const defaultKey = isWarning ? 'provisioning.warning-title-default' : 'provisioning.error-title-default';
  const defaultText = isWarning ? 'Warning' : 'Error';
  return alert.title || t(defaultKey, defaultText);
};

const getMessage = (alert: string | ProvisioningErrorInfo) => {
  if (typeof alert === 'string' || !alert.message) {
    return null;
  }

  if (Array.isArray(alert.message)) {
    return (
      <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
        {alert.message.map((msg, index) => (
          <li key={index}>{msg}</li>
        ))}
      </ul>
    );
  }

  return alert.message;
};

export function ProvisioningAlert({ error, warning }: ProvisioningAlertProps) {
  if (error) {
    return (
      <Alert severity="error" title={getTitle(error, false)}>
        {getMessage(error)}
      </Alert>
    );
  }

  if (warning) {
    return (
      <Alert severity="warning" title={getTitle(warning, true)}>
        {getMessage(warning)}
      </Alert>
    );
  }

  return null;
}
