import { v4 as uuidv4 } from 'uuid';

import { AppNotification, AppNotificationSeverity } from '../actions/types';

import { getMessageFromError } from './errors';

const defaultSuccessNotification = {
  title: '',
  text: '',
  severity: AppNotificationSeverity.Success,
  icon: 'check',
};

const defaultErrorNotification = {
  title: '',
  text: '',
  severity: AppNotificationSeverity.Error,
  icon: 'exclamation-triangle',
};

export const createSuccessNotification = (title: string, text = '', traceId?: string): AppNotification => ({
  ...defaultSuccessNotification,
  title,
  text,
  id: uuidv4(),
  timestamp: Date.now(),
  showing: true,
});

export const createErrorNotification = (
  title: string,
  text: string | Error = '',
  traceId?: string,
  component?: React.ReactElement
): AppNotification => {
  return {
    ...defaultErrorNotification,
    text: getMessageFromError(text),
    title,
    id: uuidv4(),
    traceId,
    component,
    timestamp: Date.now(),
    showing: true,
  };
};
