import { useMemo, ReactElement } from 'react';
import { v4 as uuidv4 } from 'uuid';

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

// BMC code
// const defaultInfoNotification = {
//   title: '',
//   text: '',
//   severity: AppNotificationSeverity.Info,
//   icon: 'exclamation-triangle',
// };
// Ends
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
  component?: ReactElement
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

export const createWarningNotification = (title: string, text = '', traceId?: string): AppNotification => ({
  ...defaultWarningNotification,
  title,
  text,
  traceId,
  id: uuidv4(),
  timestamp: Date.now(),
  showing: true,
});

// BMC Code: Change, added parameter component
export const createInfoNotification = (
  title: string,
  text = '',
  traceId?: string,
  component?: ReactElement
): AppNotification => ({
  severity: AppNotificationSeverity.Info,
  icon: 'info-circle',
  title,
  text,
  id: uuidv4(),
  timestamp: Date.now(),
  showing: true,
  traceId,
  component,
});

/** Hook for showing toast notifications with varying severity (success, warning, error, info).
 * @example
 * const notifyApp = useAppNotification();
 * notifyApp.success('Success!', 'Some additional text');
 * notifyApp.warning('Warning!');
 * notifyApp.error('Error!');
 * notifyApp.info('Info text');
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
      //BMC change start
      error: (title: string, text = '', bhdcode?: string, traceId?: string) => {
        dispatch(notifyApp(createErrorNotification(title, text, traceId)));
        if (bhdcode) {
          console.error(`[BHDCode: ${bhdcode}] - ${title}. ${text}`);
        }
      },
      //end
      info: (title: string, text = '') => {
        dispatch(notifyApp(createInfoNotification(title, text)));
      },
    }),
    [dispatch]
  );
}
