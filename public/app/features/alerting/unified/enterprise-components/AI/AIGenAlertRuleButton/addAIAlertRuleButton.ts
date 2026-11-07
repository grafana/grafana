import { type ComponentType, createElement } from 'react';

import { t } from '@grafana/i18n';
import { withErrorBoundary } from '@grafana/ui';

import { logError } from '../../../Analytics';

// No props needed — the component is self-contained: it generates rule form values and
// hands them to the existing creation form without saving.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AIAlertRuleButtonProps {}

let InternalAIAlertRuleButtonComponent: ComponentType<AIAlertRuleButtonProps> | null = null;

// Rendered in the alert rules page header. Returns null when no Enterprise component is registered.
export const AIAlertRuleButtonComponent: ComponentType<AIAlertRuleButtonProps> = (props) => {
  if (!InternalAIAlertRuleButtonComponent) {
    return null;
  }

  const WrappedComponent = withErrorBoundary(InternalAIAlertRuleButtonComponent, {
    title: t('alerting.ai.error-boundary.alert-rule-button', 'AI Generate Alert Rule button failed to load'),
    style: 'alertbox',
    errorLogger: logError,
  });

  return createElement(WrappedComponent, props);
};

export function addAIAlertRuleButton(component: ComponentType<AIAlertRuleButtonProps> | null) {
  InternalAIAlertRuleButtonComponent = component;
}
