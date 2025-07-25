import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { ProvisioningErrorInfo } from '../types';

import { MessageList } from './MessageList';

interface ProvisioningAlertProps {
  error?: string | ProvisioningErrorInfo;
  warning?: string | ProvisioningErrorInfo;
}

const getTitle = (alert: string | ProvisioningErrorInfo, isWarning = false) => {
  if (typeof alert === 'string') {
    return alert;
  }

  if (isWarning) {
    return alert.title || t('provisioning.warning-title-default', 'Warning');
  } else {
    return alert.title || t('provisioning.error-title-default', 'Error');
  }
};

const getMessage = (alert: string | ProvisioningErrorInfo) => {
  if (typeof alert === 'string' || !alert.message) {
    return null;
  }

  if (Array.isArray(alert.message)) {
    return <MessageList messages={alert.message} />;
  }

  return alert.message;
};

export function ProvisioningAlert({ error, warning }: ProvisioningAlertProps) {
  const alertData = error || warning;
  const isWarning = Boolean(warning);
  const severity = isWarning ? 'warning' : 'error';

  if (!alertData) {
    return null;
  }

  return (
    <Alert severity={severity} title={getTitle(alertData, isWarning)}>
      {getMessage(alertData)}
    </Alert>
  );
}
