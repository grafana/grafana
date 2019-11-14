import { AppNotification, AppNotificationSeverity, AppNotificationTimeout } from 'app/types';
import { getMessageFromError } from 'app/core/utils/errors';

const defaultSuccessNotification = {
  title: '',
  text: '',
  severity: AppNotificationSeverity.Success,
  icon: 'fa fa-check',
  timeout: AppNotificationTimeout.Success,
};

const defaultWarningNotification = {
  title: '',
  text: '',
  severity: AppNotificationSeverity.Warning,
  icon: 'fa fa-exclamation',
  timeout: AppNotificationTimeout.Warning,
};

const defaultErrorNotification = {
  title: '',
  text: '',
  severity: AppNotificationSeverity.Error,
  icon: 'fa fa-exclamation-triangle',
  timeout: AppNotificationTimeout.Error,
};

export const createSuccessNotification = (title: string, text = ''): AppNotification => ({
  ...defaultSuccessNotification,
  title: title,
  text: text,
  id: Date.now(),
});

export const createErrorNotification = (title: string, text = ''): AppNotification => {
  return {
    ...defaultErrorNotification,
    title: title,
    text: getMessageFromError(text),
    id: Date.now(),
  };
};

export const createWarningNotification = (title: string, text = ''): AppNotification => ({
  ...defaultWarningNotification,
  title: title,
  text: text,
  id: Date.now(),
});
