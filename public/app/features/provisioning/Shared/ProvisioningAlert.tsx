import { textUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Icon, Stack } from '@grafana/ui';

import { type StatusInfo } from '../types';

import { MessageList } from './MessageList';

export interface AlertAction {
  label: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
}

// A warning entry may carry its own action (e.g. one warning links to an upgrade page,
// another has no action at all), unlike error/success which are singular and share the
// top-level action prop.
export interface WarningInfo extends StatusInfo {
  action?: AlertAction;
}

interface ProvisioningAlertProps {
  error?: string | StatusInfo;
  warning?: Array<string | WarningInfo>;
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

const getButtonContent = (action?: AlertAction) => {
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

const getOnRemove = (action?: AlertAction) => {
  if (!action) {
    return undefined;
  }
  // Save href to a var for the types to resolve properly
  const href = action.href;
  if (href) {
    return () => window.open(textUtil.sanitizeUrl(href), '_blank');
  }
  return action.onClick;
};

export function ProvisioningAlert({ error, warning, success, action }: ProvisioningAlertProps) {
  const alertData = error || success;
  const type = error ? 'error' : 'success';

  return (
    <>
      {alertData && (
        <Alert
          severity={type}
          title={getTitle(alertData, type)}
          buttonContent={getButtonContent(action)}
          onRemove={getOnRemove(action)}
        >
          {getMessage(alertData)}
        </Alert>
      )}
      {warning?.map((w, i) => {
        const warningAction = typeof w === 'string' ? undefined : w.action;
        return (
          <Alert
            key={i}
            severity="warning"
            title={getTitle(w, 'warning')}
            buttonContent={getButtonContent(warningAction)}
            onRemove={getOnRemove(warningAction)}
          >
            {getMessage(w)}
          </Alert>
        );
      })}
    </>
  );
}
