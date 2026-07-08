import { type ComponentType, createElement } from 'react';

import { t } from '@grafana/i18n';
import { withErrorBoundary } from '@grafana/ui';

import { logError } from '../../Analytics';

export interface NotificationMessagePreviewProps {}

// Internal variable to store the actual component
let InternalNotificationMessagePreviewComponent: ComponentType<NotificationMessagePreviewProps> | null = null;

export const NotificationMessagePreviewComponent: ComponentType<NotificationMessagePreviewProps> = (props) => {
  if (!InternalNotificationMessagePreviewComponent) {
    return null;
  }

  // Wrap the component with error boundary
  const WrappedComponent = withErrorBoundary(InternalNotificationMessagePreviewComponent, {
    title: t(
      'alerting.enterprise-components.error-boundary.notification-message-preview',
      'Notification message preview failed to load'
    ),
    style: 'alertbox',
    errorLogger: logError,
  });

  return createElement(WrappedComponent, props);
};

export function addNotificationMessagePreview(component: ComponentType<NotificationMessagePreviewProps> | null) {
  InternalNotificationMessagePreviewComponent = component;
}
