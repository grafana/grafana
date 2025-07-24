import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { StepErrorInfo } from './types';

interface StepAlertProps {
  error: string | StepErrorInfo;
}

const getErrorTitle = (error: string | StepErrorInfo) => {
  if (typeof error === 'string') {
    return error;
  }
  return error.title || t('provisioning.wizard.error-title-default', 'Error');
};

const getErrorMessage = (error: string | StepErrorInfo) => {
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

export function StepAlert({ error }: StepAlertProps) {
  return (
    <Alert severity="error" title={getErrorTitle(error)}>
      {getErrorMessage(error)}
    </Alert>
  );
}
