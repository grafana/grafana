import { textUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Icon, Stack } from '@grafana/ui';

import { StatusInfo } from '../types';

import { MessageList } from './MessageList';

export interface AlertAction {
  label: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
}

interface ProvisioningAlertProps {
  error?: string | StatusInfo;
  warning?: string | StatusInfo;
  success?: string | StatusInfo;
  action?: AlertAction;
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

export function ProvisioningAlert({ error, warning, success, action }: ProvisioningAlertProps) {
  const alertData = error || warning || success;
  const type = error ? 'error' : warning ? 'warning' : 'success';
  const severity = type === 'success' ? 'success' : type;

  if (!alertData) {
    return null;
  }

  const message = getMessage(alertData);

  const getButtonContent = () => {
    if (!action) {
      return undefined;
    }
    if (action.href && action.external) {
      return (
        <Stack alignItems="center">
          {action.label}
          <Icon name="external-link-alt" />
        </Stack>
      );
    }
    return <span>{action.label}</span>;
  };

  const getOnRemove = () => {
    if (!action) {
      return undefined;
    }
    if (action.href) {
      return () => window.open(textUtil.sanitizeUrl(action.href!), '_blank');
    }
    return action.onClick;
  };

  return (
    <Alert
      severity={severity}
      title={getTitle(alertData, type)}
      buttonContent={action ? getButtonContent() : undefined}
      onRemove={getOnRemove()}
    >
      {message}
    </Alert>
  );
}
