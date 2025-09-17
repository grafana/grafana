import { ComponentType, createElement } from 'react';

import { t } from '@grafana/i18n';
import { withErrorBoundary } from '@grafana/ui';

import { logError } from '../../../Analytics';

export interface GenAIAlertRuleButtonProps {}

// Internal variable to store the actual component
let InternalAIAlertRuleButtonComponent: ComponentType<GenAIAlertRuleButtonProps> | null = null;

export const AIAlertRuleButtonComponent: ComponentType<GenAIAlertRuleButtonProps> = (props) => {
  if (!InternalAIAlertRuleButtonComponent) {
    return null;
  }

  // Wrap the component with error boundary
  const WrappedComponent = withErrorBoundary(InternalAIAlertRuleButtonComponent, {
    title: t('alerting.ai.error-boundary.alert-rule-button', 'AI Alert Rule Button failed to load'),
    style: 'alertbox',
    errorLogger: logError,
  });

  return createElement(WrappedComponent, props);
};

export function addAIAlertRuleButton(component: ComponentType<GenAIAlertRuleButtonProps> | null) {
  InternalAIAlertRuleButtonComponent = component;
}
