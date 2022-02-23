import { useMemo } from 'react';
import { AppNotification, AppNotificationSeverity, AppNotificationTimeout, useDispatch } from 'app/types';
import { getMessageFromError } from 'app/core/utils/errors';
import { v4 as uuidv4 } from 'uuid';
import { notifyApp } from '../actions';

const defaultSuccessNotification = {
  title: '',
  text: '',
  severity: AppNotificationSeverity.Success,
  icon: 'check',
  timeout: AppNotificationTimeout.Success,
};

const defaultWarningNotification = {
  title: '',
  text: '',
  severity: AppNotificationSeverity.Warning,
  icon: 'exclamation-triangle',
  timeout: AppNotificationTimeout.Warning,
};

const defaultErrorNotification = {
  title: '',
  text: '',
  severity: AppNotificationSeverity.Error,
  icon: 'exclamation-triangle',
  timeout: AppNotificationTimeout.Error,
};

export const createSuccessNotification = (title: string, text = ''): AppNotification => ({
  ...defaultSuccessNotification,
  title: title,
  text: text,
  id: uuidv4(),
});

export const createErrorNotification = (
  title: string,
  text: string | Error = '',
  component?: React.ReactElement
): AppNotification => {
  return {
    ...defaultErrorNotification,
    text: getMessageFromError(text),
    title,
    id: uuidv4(),
    component,
  };
};

export const createWarningNotification = (title: string, text = ''): AppNotification => ({
  ...defaultWarningNotification,
  title: title,
  text: text,
  id: uuidv4(),
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
      warning: (title: string, text = '') => {
        dispatch(notifyApp(createWarningNotification(title, text)));
      },
      error: (title: string, text = '') => {
        dispatch(notifyApp(createErrorNotification(title, text)));
      },
    }),
    [dispatch]
  );
}
