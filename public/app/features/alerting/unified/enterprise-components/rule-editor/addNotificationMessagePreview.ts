import { type ComponentType, createElement } from 'react';

import { t } from '@grafana/i18n';
import { withErrorBoundary } from '@grafana/ui';

import { logError } from '../../Analytics';

export interface NotificationMessagePreviewProps {}

let RegisteredNotificationMessagePreviewComponent: ComponentType<NotificationMessagePreviewProps> | null = null;

export const NotificationMessagePreviewComponent: ComponentType<NotificationMessagePreviewProps> = (props) => {
  if (!RegisteredNotificationMessagePreviewComponent) {
    return null;
  }

  return createElement(RegisteredNotificationMessagePreviewComponent, props);
};

export function addNotificationMessagePreview(component: ComponentType<NotificationMessagePreviewProps> | null) {
  RegisteredNotificationMessagePreviewComponent = component
    ? withErrorBoundary(component, {
        title: t(
          'alerting.enterprise-components.error-boundary.notification-message-preview',
          'Notification message preview failed to load'
        ),
        style: 'alertbox',
        errorLogger: logError,
      })
    : null;
}
