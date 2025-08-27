import { ComponentType, createElement } from 'react';

import { t } from '@grafana/i18n';
import { withErrorBoundary } from '@grafana/ui';

import { logError } from '../../../../Analytics';

export interface GenNotificationMessageSectionExtensionProps {}

// Internal variable to store the extension component, for now only one component is supported
let InternalNotificationMessageSectionExtension: ComponentType<GenNotificationMessageSectionExtensionProps> | null =
  null;

// This component is used to render the notification message section extension.
export const NotificationMessageSectionExtension: ComponentType<GenNotificationMessageSectionExtensionProps> = (
  props
) => {
  if (!InternalNotificationMessageSectionExtension) {
    return null;
  }

  // Wrap the component with error boundary
  const WrappedComponent = withErrorBoundary(InternalNotificationMessageSectionExtension, {
    title: t(
      'alerting.ai.error-boundary.notification-message-section-extension',
      'Notification Message Section Extension failed to load'
    ),
    style: 'alertbox',
    errorLogger: logError,
  });

  return createElement(WrappedComponent, props);
};

export function addRuleFormEnrichmentSection(
  component: ComponentType<GenNotificationMessageSectionExtensionProps> | null
) {
  InternalNotificationMessageSectionExtension = component;
}
