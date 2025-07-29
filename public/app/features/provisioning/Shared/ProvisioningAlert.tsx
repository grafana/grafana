import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { StatusInfo } from '../types';

import { MessageList } from './MessageList';

interface ProvisioningAlertProps {
  error?: string | StatusInfo;
  warning?: string | StatusInfo;
  success?: string | StatusInfo;
}

const getTitle = (alert: string | StatusInfo, type: 'error' | 'warning' | 'success' = 'error') => {
  if (typeof alert === 'string') {
    return alert;
  }

  if (type === 'warning') {
    return alert.title || t('provisioning.warning-title-default', 'Warning');
  } else if (type === 'success') {
    return alert.title || t('provisioning.success-title-default', 'Success');
  } else {
    return alert.title || t('provisioning.error-title-default', 'Error');
  }
};

const getMessage = (alert: string | StatusInfo) => {
  if (typeof alert === 'string' || !alert.message) {
    return null;
  }

  if (Array.isArray(alert.message)) {
    return <MessageList messages={alert.message} />;
  }

  return alert.message;
};

export function ProvisioningAlert({ error, warning, success }: ProvisioningAlertProps) {
  const alertData = error || warning || success;
  const type = error ? 'error' : warning ? 'warning' : 'success';
  const severity = type === 'success' ? 'success' : type;

  if (!alertData) {
    return null;
  }

  return (
    <Alert severity={severity} title={getTitle(alertData, type)}>
      {getMessage(alertData)}
    </Alert>
  );
}
