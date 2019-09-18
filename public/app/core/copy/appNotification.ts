import { AppNotification, AppNotificationTimeout } from 'app/types';
import { AlertVariant } from '@grafana/ui';
import { getMessageFromError } from 'app/core/utils/errors';

const defaultSuccessNotification = {
  title: '',
  text: '',
  severity: AlertVariant.Success,
  icon: 'fa fa-check',
  timeout: AppNotificationTimeout.Success,
};

const defaultWarningNotification = {
  title: '',
  text: '',
  severity: AlertVariant.Warning,
  icon: 'fa fa-exclamation',
  timeout: AppNotificationTimeout.Warning,
};

const defaultErrorNotification = {
  title: '',
  text: '',
  severity: AlertVariant.Error,
  icon: 'fa fa-exclamation-triangle',
  timeout: AppNotificationTimeout.Error,
};

export const createSuccessNotification = (title: string, text?: string): AppNotification => ({
  ...defaultSuccessNotification,
  title: title,
  text: text,
  id: Date.now(),
});

export const createErrorNotification = (title: string, text?: any): AppNotification => {
  return {
    ...defaultErrorNotification,
    title: title,
    text: getMessageFromError(text),
    id: Date.now(),
  };
};

export const createWarningNotification = (title: string, text?: string): AppNotification => ({
  ...defaultWarningNotification,
  title: title,
  text: text,
  id: Date.now(),
});
