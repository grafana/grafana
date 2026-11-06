import { type ComponentType, createElement } from 'react';

import { t } from '@grafana/i18n';
import { withErrorBoundary } from '@grafana/ui';

import { logError } from '../../../Analytics';

// No props needed — the component is self-contained: it generates rule form values and
// hands them to the existing creation form without saving.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AINewAlertRuleButtonProps {}

let InternalAINewAlertRuleButtonComponent: ComponentType<AINewAlertRuleButtonProps> | null = null;

// Rendered in the alert rules page header. Returns null when no Enterprise component is registered.
export const AINewAlertRuleButtonComponent: ComponentType<AINewAlertRuleButtonProps> = (props) => {
  if (!InternalAINewAlertRuleButtonComponent) {
    return null;
  }

  const WrappedComponent = withErrorBoundary(InternalAINewAlertRuleButtonComponent, {
    title: t('alerting.ai.error-boundary.new-alert-rule-button', 'AI Generate Alert Rule button failed to load'),
    style: 'alertbox',
    errorLogger: logError,
  });

  return createElement(WrappedComponent, props);
};

export function addAINewAlertRuleButton(component: ComponentType<AINewAlertRuleButtonProps> | null) {
  InternalAINewAlertRuleButtonComponent = component;
}
