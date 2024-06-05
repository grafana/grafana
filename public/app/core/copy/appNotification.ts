import { useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { logzioServices } from '@grafana/data'; // LOGZ.IO GRAFANA CHANGE :: DEV-23041 - log to logzio on any error
import { getMessageFromError } from 'app/core/utils/errors';
import { AppNotification, AppNotificationSeverity, useDispatch } from 'app/types';

import { notifyApp } from '../actions';

const defaultSuccessNotification = {
  title: '',
  text: '',
  severity: AppNotificationSeverity.Success,
  icon: 'check',
};

const defaultWarningNotification = {
  title: '',
  text: '',
  severity: AppNotificationSeverity.Warning,
  icon: 'exclamation-triangle',
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
  // LOGZ.IO GRAFANA CHANGE :: DEV-23041 - log to logzio on any error
  const logzLogger = logzioServices.LoggerService;
  logzLogger.logError({
    origin: logzLogger.Origin.GRAFANA,
  message: getMessageFromError(text) || title || 'Unknown error from metrics product', // DEV-45291 - use title if message is empty string
    error: null,
    uxType: logzLogger.UxType.TOAST,
    extra: {
      title,
    },
  });

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

export const createWarningNotification = (title: string, text = '', traceId?: string): AppNotification => ({
  ...defaultWarningNotification,
  title,
  text,
  traceId,
  id: uuidv4(),
  timestamp: Date.now(),
  showing: true,
});

/** Hook for showing toast notifications with varying severity (success, warning error).
 * @example
 * const notifyApp = useAppNotification();
 * notifyApp.success('Success!', 'Some additional text');
 * notifyApp.warning('Warning!');
 * notifyApp.error('Error!');
 */
export function useAppNotification() {
  const dispatch = useDispatch();
  return useMemo(
    () => ({
      success: (title: string, text = '') => {
        dispatch(notifyApp(createSuccessNotification(title, text)));
      },
      warning: (title: string, text = '', traceId?: string) => {
        dispatch(notifyApp(createWarningNotification(title, text, traceId)));
      },
      error: (title: string, text = '', traceId?: string) => {
        dispatch(notifyApp(createErrorNotification(title, text, traceId)));
      },
    }),
    [dispatch]
  );
}
